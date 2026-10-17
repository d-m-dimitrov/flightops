const express=require('express'),router=express.Router();
const User=require('../models/User'),Shift=require('../models/StaffShift'),Cycle=require('../models/RosterCycle'),Draft=require('../models/RosterDraft');
const department=require('../services/departmentAccess'),access=require('../services/assignmentAccess');
const planning=require('../services/rosterPlanning'),shiftService=require('../services/staffShifts');
router.use(require('../middleware/requireUser'));
router.use((req,res,next)=>{res.set('Cache-Control','no-store');if(!access(req.user).length)return res.status(403).json({error:'Roster planning requires allocator or duty manager'});next();});
const dept=req=>department.superAdmin(req.user)?req.query.department||req.body?.department:req.user.department;
function authorised(req,target){return target&&department.departments[target]&&(department.superAdmin(req.user)||req.user.department===target);}
function bad(res,error){return res.status(400).json({error:error.message});}
router.get('/',async(req,res)=>{
 const month=req.query.month,d=dept(req);if(!planning.validMonth(month)||!authorised(req,d))return res.status(400).json({error:'Choose an authorised department and month'});
 const members=await User.find({active:true,department:d,role:{$ne:'ADMIN'}}).select('_id name department').sort({name:1}).lean();
 const ids=members.map(u=>u._id),cycle=await Cycle.find({userId:{$in:ids}}).lean();
 const shifts=await Shift.find({userId:{$in:ids},date:{$gte:month+'-01',$lte:planning.days(month).at(-1)}}).lean();
 const draft=await Draft.findOne({department:d,month}).lean();
 res.json({department:d,month,staff:members,cycles:cycle,shifts,draft,days:planning.days(month)});
});
router.put('/cycle/:userId',async(req,res)=>{
 const user=await User.findById(req.params.userId).select('active department role');
 if(!user?.active||!department.canViewStaff(req.user,user))return res.status(404).json({error:'Employee not found'});
 if(!access(req.user).length)return res.sendStatus(403);
 const {pattern,startDate}=req.body;
 if(!planning.patterns[pattern]||!require('../../client/js/airlineQualifications').date(startDate))return res.status(400).json({error:'Invalid pattern or cycle start date'});
 const cycle=await Cycle.findOneAndUpdate({userId:user._id},{$set:{pattern,startDate,updatedBy:req.user._id}},{upsert:true,new:true,runValidators:true});
 res.json(cycle);
});
router.post('/draft',async(req,res)=>{
 const {month}=req.body,d=dept(req);if(!planning.validMonth(month)||!authorised(req,d))return res.status(400).json({error:'Invalid month or department'});
 const exists=await Draft.findOne({department:d,month});if(exists)return res.status(409).json({error:'Draft already exists; edit rather than regenerate'});
 const staff=await User.find({active:true,department:d,role:{$ne:'ADMIN'}}).select('_id name department').lean();
 const ids=staff.map(u=>u._id),cycles=await Cycle.find({userId:{$in:ids}}).lean();
 const shifts=await Shift.find({userId:{$in:ids},date:{$gte:month+'-01',$lte:planning.days(month).at(-1)}}).lean();
 const output=planning.initialEntries(staff,cycles,shifts,month);
 const draft=await Draft.create({department:d,month,createdBy:req.user._id,entries:output.entries});
 res.status(201).json({draft,skipped:output.skipped});
});
router.put('/draft',async(req,res)=>{
 const {month,expectedRevision,edits}=req.body,d=dept(req);
 if(!planning.validMonth(month)||!authorised(req,d)||!Number.isInteger(expectedRevision)||expectedRevision<1||!Array.isArray(edits)||edits.length>1500)return res.status(400).json({error:'Invalid roster draft request'});
 const draft=await Draft.findOne({department:d,month,status:'DRAFT',revision:expectedRevision});
 if(!draft)return res.status(409).json({error:'Draft changed or was published; reload'});
 const users=await User.find({active:true,department:d,role:{$ne:'ADMIN'}}).select('_id').lean(),ids=new Set(users.map(u=>String(u._id)));
 const entries=new Map(draft.entries.map(e=>[String(e.userId)+'|'+e.date,e]));
 try{
 for(const edit of edits){
  if(!ids.has(String(edit.userId)))throw Error('Employee is outside your department');
  const key=String(edit.userId)+'|'+edit.date,row=entries.get(key);
  if(!row)throw Error('Only generated, unoccupied draft dates can be edited');
  if(!['EARLY','DAY','LATE','OFF'].includes(edit.status))throw Error('Invalid shift type');
  row.status=edit.status;row.startTime=planning.validateStart(edit.status,edit.startTime);row.changed=true;
 }
 }catch(error){return bad(res,error);}
 const saved=await Draft.findOneAndUpdate({_id:draft._id,revision:expectedRevision,status:'DRAFT'},{$set:{entries:draft.entries},$inc:{revision:1}},{new:true,runValidators:true});
 if(!saved)return res.status(409).json({error:'Draft was updated concurrently'});
 res.json({draft:saved});
});
router.post('/publish',async(req,res)=>{
 const {month,expectedRevision}=req.body,d=dept(req);
 if(!planning.validMonth(month)||!authorised(req,d)||!Number.isInteger(expectedRevision))return res.status(400).json({error:'Invalid publication request'});
 const draft=await Draft.findOne({department:d,month,status:'DRAFT',revision:expectedRevision});
 if(!draft)return res.status(409).json({error:'Draft changed; reload'});
 const users=await User.find({active:true,department:d,role:{$ne:'ADMIN'}}).select('_id').lean(),ids=new Set(users.map(u=>String(u._id)));
 const existing=await Shift.find({userId:{$in:users.map(u=>u._id)},date:{$gte:month+'-01',$lte:planning.days(month).at(-1)}}).lean();
 const occupied=new Set(existing.map(s=>String(s.userId)+'|'+s.date)),prepared=[],skipped=[];
 try{
 for(const entry of draft.entries){
  const key=String(entry.userId)+'|'+entry.date;
  if(!ids.has(String(entry.userId))||!planning.days(month).includes(entry.date))throw Error('Draft includes an out-of-scope employee or date');
  if(occupied.has(key)){skipped.push(key+' already scheduled');continue;}
  if(entry.status!=='OFF'&&!entry.startTime)throw Error('Assign a start time to every working draft cell before publishing: '+key);
  const clock=planning.validateStart(entry.status,entry.startTime);
  const input={date:entry.date,status:entry.status==='OFF'?'OFF':'WORKING',expectedRevision:0,breaks:[]};
  if(clock)Object.assign(input,planning.times(entry.date,clock));
  prepared.push({userId:entry.userId,...shiftService.validate(input),revision:1,updatedBy:req.user._id,updatedByName:req.user.name});
 }
 }catch(error){return bad(res,error);}
 // Insert-only: even a concurrent manual roster update is never overwritten.
 let created=0;
 for(const row of prepared){try{await Shift.create(row);created++;}catch(error){if(error.code===11000){skipped.push(String(row.userId)+'|'+row.date+' created concurrently');continue;}throw error;}}
 const published=await Draft.findOneAndUpdate({_id:draft._id,status:'DRAFT',revision:expectedRevision},{$set:{status:'PUBLISHED',publishedAt:new Date(),publishedBy:req.user._id},$inc:{revision:1}},{new:true});
 if(!published)return res.status(409).json({error:'Draft changed during publication; shifts created: '+created});
 res.json({created,skipped,published:true});
});
module.exports=router;
