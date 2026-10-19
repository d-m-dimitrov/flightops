const express = require('express');
const router = express.Router();
const Instruction = require('../models/HandlingInstruction');
const requireUser = require('../middleware/requireUser');
const { superAdmin } = require('../services/departmentAccess');
router.use(requireUser, (req,res,next) => superAdmin(req.user) ? next() : res.status(403).json({error:'Super Admin access required'}));
const fields = ['airline','aircraftType','operation','department','role','type','title','body','active'];
function validate(input) {
 const row = {};
 for (const key of fields) row[key] = input[key];
 for (const key of ['airline','aircraftType','operation','department','role','type']) row[key] = String(row[key] || '').trim().toUpperCase();
 row.aircraftType ||= 'ALL'; row.role ||= 'ALL';
 row.title = String(row.title || '').trim(); row.body = String(row.body || '').trim();
 if (!/^[A-Z0-9]{2,12}$/.test(row.airline)) throw Error('Invalid airline code');
 if (!/^[A-Z0-9_-]{1,20}$/.test(row.aircraftType)) throw Error('Invalid aircraft type');
 if (!['ARRIVAL','DEPARTURE','TURNAROUND'].includes(row.operation)) throw Error('Invalid operation');
 if (!/^[A-Z0-9_]{2,40}$/.test(row.department)) throw Error('Invalid department');
 if (!/^[A-Z0-9_]{1,40}$/.test(row.role)) throw Error('Invalid role');
 if (!['INFO','MANDATORY','CHECKLIST'].includes(row.type)) throw Error('Invalid instruction type');
 if (!row.title || row.title.length > 160 || !row.body || row.body.length > 4000) throw Error('Title and instruction text required (maximum 160 / 4000 characters)');
 row.active = input.active === true;
 return row;
}
router.get('/', async(req,res,next) => {try {res.json(await Instruction.find().sort({airline:1,operation:1,title:1}).lean());} catch(e){next(e);}});
router.post('/', async(req,res,next) => {try {const row=validate(req.body||{});row.active=false;res.status(201).json(await Instruction.create(row));}catch(e){res.status(400).json({error:e.message});}});
router.patch('/:id', async(req,res,next) => {try {
 if(!/^[a-f0-9]{24}$/i.test(req.params.id)) return res.status(400).json({error:'Invalid ID'});
 const doc=await Instruction.findById(req.params.id);
 if(!doc)return res.status(404).json({error:'Instruction not found'});
 if(Number(req.body.revision)!==doc.revision)return res.status(409).json({error:'This instruction changed. Reload before editing.'});
 const row=validate(req.body||{});
 Object.assign(doc,row);doc.revision+=1;await doc.save();res.json(doc);
}catch(e){res.status(400).json({error:e.message});}});
module.exports=router;
