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
    if (req.method === 'GET' || req.user.role === 'ADMIN' ||
        (req.user.department === 'OPERATIONS' && req.user.position === 'OPERATIONS_DM')) return next();
    res.status(403).json({error:'Only the Operations duty manager can manage staff accounts'});
});

router.get(
"/",
async(req,res)=>{

    const users =
    await User.find().select("-passwordHash")
    .sort({
        name:1
    });

    res.json(users);

});


router.put(
"/:id",
async(req,res)=>{

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

    let filter = {_id:req.params.id}, update = {$set:updateData};
    if (req.body.airlineQualifications !== undefined) {
        try { updateData.airlineQualifications = Qualifications.normalize(req.body.airlineQualifications); }
        catch(error) { return res.status(400).json({error:error.message}); }
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

    const safeUser = user ? user.toObject() : null;
    if (safeUser) delete safeUser.passwordHash;
    res.json(safeUser);

}); 



router.post(
"/",
async(req,res)=>{

    let airlineQualifications;
    try { airlineQualifications = Qualifications.normalize(req.body.airlineQualifications ?? []); }
    catch(error) { return res.status(400).json({error:error.message}); }
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