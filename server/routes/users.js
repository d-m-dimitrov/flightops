const access = require('../services/departmentAccess');
const positions = require('../config/positions');
const Qualifications = require('../../client/js/airlineQualifications');
const bcrypt =
require("bcryptjs");

const express =
require("express");

const router =
express.Router();

const User =
require("../models/User");

router.use(require('../middleware/requireUser'));
router.use((req,res,next) => {
    if (req.method === 'GET' || access.superAdmin(req.user) || access.dutyManager(req.user)) return next();
    res.status(403).json({error:'Only Super Admin or your department Duty Manager can manage staff accounts'});
});

router.get(
"/",
async(req,res)=>{

    const users =
    await User.find(access.staffFilter(req.user)).select("-passwordHash")
    .sort({
        name:1
    });

    res.json(users);

});


router.put(
"/:id",
async(req,res)=>{

    const target = await User.findById(req.params.id);
    if (!target || !access.canManageStaff(req.user,target)) return res.status(404).json({error:'Staff record not found in your department'});
    if (req.body.role !== undefined) return res.status(400).json({error:'Account roles cannot be changed here'});
    if (!access.superAdmin(req.user) && req.body.department !== req.user.department) return res.status(403).json({error:'You cannot move staff to another department'});
    if (!positions.some(p => p.department === req.body.department && p.code === req.body.position)) return res.status(400).json({error:'Select a position in the chosen department'});
    if (!Array.isArray(req.body.skills) || req.body.skills.some(role => !access.roles({active:true,role:'OPERATIONS',department:req.body.department}).includes(role))) return res.status(400).json({error:'Skills must belong to the employee department'});

const updateData = {

    name:req.body.name,

    phone:req.body.phone,

    email:req.body.email,

    department:req.body.department,

    position:req.body.position,

    skills:req.body.skills || [],

    active:req.body.active

};

    if(req.body.password){

        updateData.passwordHash =
        await bcrypt.hash(

            req.body.password,

            10

        );

    }

    let filter = {_id:req.params.id,...access.staffFilter(req.user)}, update = {$set:updateData};
    if (req.body.airlineQualifications !== undefined) {
        try { updateData.airlineQualifications = Qualifications.normalize(req.body.airlineQualifications); }
        catch(error) { return res.status(400).json({error:error.message}); }
        if (updateData.airlineQualifications.some(q=>!access.roles({active:true,department:req.body.department}).includes(q.role))) return res.status(400).json({error:'Qualifications must belong to the employee department'});
        const revision = req.body.expectedQualificationRevision;
        if (!Number.isInteger(revision) || revision < 0) return res.status(400).json({error:'Reload the staff record before changing qualifications'});
        filter = {...filter, ...(revision === 0 ? {$or:[{qualificationRevision:0},{qualificationRevision:{$exists:false}}]} : {qualificationRevision:revision})};
        updateData.qualificationsUpdatedAt = new Date();
        updateData.qualificationsUpdatedBy = req.user._id;
        update.$inc = {qualificationRevision:1};
    }
    const user = await User.findOneAndUpdate(filter, update, {returnDocument:'after',runValidators:true});
    if (!user) return res.status(409).json({error:'Staff record changed or was removed. Reopen it before saving.'});

    const safeUser = user ? user.toObject() : null;
    if (safeUser) delete safeUser.passwordHash;
    res.json(safeUser);

});

router.get(
"/:id",
async(req,res)=>{

    const user =
    await User.findById(
        req.params.id
    );

    if (!user || !access.canViewStaff(req.user,user)) return res.status(404).json({error:'Staff record not found in your department'});
    const safeUser = user ? user.toObject() : null;
    if (safeUser) delete safeUser.passwordHash;
    res.json(safeUser);

}); 



router.post(
"/",
async(req,res)=>{

    if (req.body.role !== undefined) return res.status(400).json({error:'Account roles cannot be assigned here'});
    if (!access.superAdmin(req.user) && req.body.department !== req.user.department) return res.status(403).json({error:'You can create staff only in your department'});
    if (!positions.some(p => p.department === req.body.department && p.code === req.body.position)) return res.status(400).json({error:'Select a position in the chosen department'});
    if (!Array.isArray(req.body.skills) || req.body.skills.some(role => !access.roles({active:true,role:'OPERATIONS',department:req.body.department}).includes(role))) return res.status(400).json({error:'Skills must belong to the employee department'});
    let airlineQualifications;
    try { airlineQualifications = Qualifications.normalize(req.body.airlineQualifications ?? []); }
    catch(error) { return res.status(400).json({error:error.message}); }
    if (airlineQualifications.some(q=>!access.roles({active:true,department:req.body.department}).includes(q.role))) return res.status(400).json({error:'Qualifications must belong to the employee department'});
    let passwordHash = "";

    if(req.body.password){

        passwordHash =
        await bcrypt.hash(

            req.body.password,

            10

        );

    }

    const user =
await User.create({

    name:req.body.name,

    phone:req.body.phone,

    email:req.body.email,

    department:req.body.department,

    position:req.body.position,

    skills:req.body.skills || [],

    active:req.body.active,
    role:"OPERATIONS",

    airlineQualifications,
    qualificationsUpdatedAt:new Date(),
    qualificationsUpdatedBy:req.user._id,
    passwordHash

});

    const safeUser = user ? user.toObject() : null;
    if (safeUser) delete safeUser.passwordHash;
    res.json(safeUser);

});

module.exports =
router;