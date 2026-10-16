const departmentAccess = require('../services/departmentAccess');
const express =
require("express");

const router =
express.Router();

const Assignment =
require("../models/Assignment");

const User =
require("../models/User");

const ChatMessage =
require("../models/ChatMessage");



const Qualifications = require('../../client/js/airlineQualifications');
const Turnaround = require('../models/Turnaround');
const mongoose = require('mongoose');
const assignmentRoles = require('../services/assignmentAccess');
router.use(require('../middleware/requireUser'));

router.get(
"/:turnaroundId",
async(req,res)=>{

    const assignments =
    await Assignment.find({

        turnaroundId:
        req.params.turnaroundId

    })
    .populate(
        "userId", "name phone email department position skills active role airlineQualifications"
    );

    const flight = await Turnaround.findOne({_id:req.params.turnaroundId,deleted:{$ne:true}});
    if (!flight) return res.status(404).json({error:'Flight not found'});
    res.json(assignments.filter(a => departmentAccess.roles(req.user).includes(a.role) && (!a.userId || departmentAccess.canViewStaff(req.user,a.userId))).map(a => ({...(a.toObject ? a.toObject() : a),
        qualificationWarning:Qualifications.reason(a.userId,flight.airline,a.role,flight.operatingDate)
    })));

});

router.post(
"/:turnaroundId",
async(req,res)=>{

    const turnaroundId =
    req.params.turnaroundId;

    const allowed = assignmentRoles(req.user);
    if (!allowed.length) return res.status(403).json({error:'You cannot manage flight assignments'});
    if (!mongoose.isObjectIdOrHexString(turnaroundId)) return res.status(400).json({error:'Invalid flight'});
    const assignments = req.body.assignments;
    if (!Array.isArray(assignments) || assignments.length > allowed.length ||
        assignments.some(item => !item || !allowed.includes(item.role) || !mongoose.isObjectIdOrHexString(item.userId)) ||
        new Set(assignments.map(item => item.role)).size !== assignments.length) {
        return res.status(400).json({error:'Invalid or unauthorized assignment roles'});
    }
    const flight = await Turnaround.findOne({_id:turnaroundId,deleted:{$ne:true}});
    if (!flight) return res.status(404).json({error:'Flight not found'});
    for (const item of assignments) {
        const target = await User.findById(item.userId);
        if (!departmentAccess.canViewStaff(req.user,target)) return res.status(400).json({error:"Select an agent in your department"});
        const reason = Qualifications.reason(target,flight.airline,item.role,flight.operatingDate);
        if (reason) return res.status(400).json({error:`${target?.name || 'Agent'}: ${reason}. Assignment blocked; no override is allowed.`});
    }
    const updatedByName = req.user.name;

    const existing =
    await Assignment.find({

        turnaroundId, role:{$in:allowed}

    })
    .populate(
        "userId",
        "name"
    );

    // Compare the exact editable assignment snapshot, not acceptance timestamps.
    // A stale control form must be reopened before it can replace newer allocations.
    if (req.body.expectedAssignments !== undefined) {
        const expected = req.body.expectedAssignments;
        if (!Array.isArray(expected) || expected.length > 100 || expected.some(value => typeof value !== 'string')) {
            return res.status(400).json({error:'Invalid assignment snapshot'});
        }
        const actual = existing.map(a => `${a._id}:${a.role}:${a.userId?._id || ''}`).sort();
        if (JSON.stringify([...expected].sort()) !== JSON.stringify(actual)) {
            return res.status(409).json({error:'Assignments changed. Reopen the editor before saving.'});
        }
    }

    const oldMap = {};

    existing.forEach(a=>{

        oldMap[a.role] = {

            userId:
            a.userId?._id?.toString(),

            name:
            a.userId?.name

        };

    });

    const unchangedRoles = assignments.filter(item => {
        const matches=existing.filter(a=>a.role===item.role);
        return matches.length===1 && String(matches[0].userId?._id)===item.userId;
    }).map(item=>item.role);
    await Assignment.deleteMany({

        turnaroundId, role:{$in:allowed.filter(role=>!unchangedRoles.includes(role))}

    });

    for(const item of assignments){

        if(unchangedRoles.includes(item.role)){delete oldMap[item.role];continue;}
        await Assignment.create({

            turnaroundId,

            role:item.role,

            userId:item.userId

        });

        const newUser =
        await User.findById(
            item.userId
        );

        const old =
        oldMap[item.role];

        if(!old){

            await ChatMessage.create({

                turnaroundId,

                messageType:
                "SYSTEM",

                message:

                `${updatedByName} assigned ${newUser.name} to ${item.role}`

            });

        }
        else if(

            old.userId !==
            item.userId

        ){

            await ChatMessage.create({

                turnaroundId,

                messageType:
                "SYSTEM",

                message:

                `${updatedByName} reassigned ${item.role} from ${old.name} to ${newUser.name}`

            });

        }

        delete oldMap[
            item.role
        ];

    }

    for(const role in oldMap){

        await ChatMessage.create({

            turnaroundId,

            messageType:
            "SYSTEM",

            message:

            `${updatedByName} removed ${role} assignment (${oldMap[role].name})`

        });

    }
    require('../services/lirLive').clearFlight(req.app.get('io'), turnaroundId);
    req.app.get('io').to(turnaroundId).emit('assignmentsUpdated');
    req.app
.get("io")
.to(
    turnaroundId
)
.emit(
    "flightUpdated"
);

    res.json({
        success:true
    });

});


module.exports =
router;