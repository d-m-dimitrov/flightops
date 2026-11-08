const express = require('express');
const mongoose = require('mongoose');
const Turnaround = require('../models/Turnaround');
const Lir = require('../models/Lir');
const Checklist=require('../models/LirChecklist');
const requireUser = require('../middleware/requireUser');
const validate = require('../services/lirValidation');
const canAnnotate = require('../services/lirAccess');
const addSystemMessage = require('../services/systemMessage');
const router = express.Router();
const DEFAULT_BULK_POSITIONS = ['51','52','53'];
// Airline and IATA aircraft codes are both used in flight records.
// Unknown types remain configurable but are explicitly flagged for manual checking.
const bulkPositionRules = aircraftType => {
 const type=String(aircraftType||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
 const one=/(?:A350|A358|A359|A35K|AIRBUS350|B787|B788|B789|B78X|BOEING787)/.test(type);
 const two=/(?:B777|B772|B773|B77W|B77L|B77F|BOEING777)/.test(type);
 const three=/(?:A321|A21N|AIRBUS321|A330|A332|A333|A338|A339|AIRBUS330|A380|A388|AIRBUS380)/.test(type);
 const count=one?1:two?2:three?3:null;
 return {aircraftType:String(aircraftType||'').trim(),positions:count?DEFAULT_BULK_POSITIONS.slice(0,count):DEFAULT_BULK_POSITIONS.slice(),known:count!==null};
};
const isBulkRow = row => row?.uldType === 'BULK' || row?.position === 'BULK';
router.use(requireUser);
router.use((req,res,next) => {
  req.lirPermissions = validate.permissions(req.user);
  if (!req.lirPermissions.view) return res.status(403).json({ error:'LIR access is limited to OPS and RAMP' });
  res.set('Cache-Control','no-store');
  next();
});
router.use(express.json({ limit:'8mb' }));
router.param('flightId', async (req,res,next,id) => {
  if (!mongoose.isObjectIdOrHexString(id)) return res.status(400).json({ error:'Invalid flight' });
  const flight = await Turnaround.findById(id);
  if (!flight || flight.deleted) return res.status(404).json({ error:'Flight not found' });
  req.flight = flight;
  next();
});
router.param('documentId', (req,res,next,id) => {
  if (!mongoose.isObjectIdOrHexString(id)) return res.status(400).json({ error:'Invalid LIR' });
  next();
});
const latest = flightId => Lir.findOne({ turnaroundId:flightId }).sort({ revision:-1 });
async function notify(req, doc, message) {
  require("../services/lirLive").clearFlight(req.app.get("io"), req.flight._id);
  // Save success must remain success even if the optional chat notification fails.
  try { await addSystemMessage(req, req.flight._id, message); }
  catch (error) { console.error('LIR notification failed:', error.message); }
  req.app.get('io').to(String(req.flight._id)).emit('lirUpdated', { revision:doc.revision, status:doc.status });
}
router.get('/:flightId/access', async (req,res) => {
  res.json({ user:{id:req.user._id,name:req.user.name}, permissions:{ ...req.lirPermissions, annotate:await canAnnotate(req.user,req.flight._id) } });
});
router.get('/:flightId', async (req,res) => {
  req.lirPermissions.annotate = await canAnnotate(req.user, req.flight._id);
  const revisions = await Lir.find({ turnaroundId:req.flight._id })
    .select('-annotations -signature').sort({ revision:-1 });
  const doc = revisions.length ? await Lir.findById(revisions[0]._id) : null;
  res.json({ flight:{ id:req.flight._id, display:req.flight.flightNumberDisplay || `${req.flight.arrivalFlight}/${req.flight.departureFlight}`, operatingDate:req.flight.operatingDate },
    permissions:req.lirPermissions, sequence:req.flight.lirSequence || 0, document:doc, revisions });
});
router.get('/:flightId/checklist',async(req,res)=>{
 const doc=await latest(req.flight._id);if(!doc)return res.status(404).json({error:'No LIR'});
 const saved=await Checklist.findOne({turnaroundId:req.flight._id,lirId:doc._id}).lean();
 const ramp=await canAnnotate(req.user,req.flight._id);
 const assigned=await require('../models/Assignment').find({turnaroundId:req.flight._id,role:'RAMP'}).select('userId').lean();
 const reason=ramp?'':!req.user.active?'Your account is inactive':req.user.department!=='RAMP'?'This account is not in the RAMP department':assigned.length!==1?'Departure RAMP assignment is missing or ambiguous':String(assigned[0].userId)!==String(req.user._id)?'Another agent is assigned to Departure RAMP':'RAMP confirmation is unavailable';
 res.json({checklist:saved,permissions:{publish:req.lirPermissions.upload,confirm:ramp,confirmReason:reason},revision:doc.revision,bulkRules:bulkPositionRules(req.flight.aircraft?.aircraftType)});
});
router.put('/:flightId/checklist/draft',async(req,res)=>{
 if(!req.lirPermissions.upload)return res.status(403).json({error:'OPS only'});
 const doc=await latest(req.flight._id);if(!doc||doc.kind!=='text')return res.status(400).json({error:'Text LIR required'});
 const existing=await Checklist.findOne({turnaroundId:req.flight._id});
 if(existing?.published&&String(existing.lirId)===String(doc._id))return res.status(409).json({error:'Published checklist cannot be edited as a draft'});
 const source=await Lir.findById(doc._id).select('+original');
 const raw=source.original.toString('utf8');
 if(!raw.includes('LOADING INSTRUCTION/REPORT')||!raw.includes(' TK '))return res.status(400).json({error:'Unsupported LIR format'});
 const parsed=require('../services/tkLirParser').parse(raw);
 const input=req.body.rows;
 if(!Array.isArray(input)||input.length<parsed.rows.length||input.length>parsed.rows.length+3)return res.status(400).json({error:'All parsed positions must be reviewed'});
 const rows=parsed.rows.map((row,i)=>{
  const edit=input[i];
  if(!edit||edit.position!==row.position)throw new Error('Position order changed');
  const plannedUld=String(edit.plannedUld||'').trim().toUpperCase();
  if(plannedUld&&!/^[A-Z]{3}[A-Z0-9]{5,12}$/.test(plannedUld))throw new Error('Invalid ULD at '+row.position);
  const load=String(edit.load||'').trim().toUpperCase();
  if(load.length>120)throw new Error('Load text too long');
  const dgStatus=['UNKNOWN','NO_DG','DG_PRESENT'].includes(edit.dgStatus)?edit.dgStatus:'UNKNOWN';
  return {...row,plannedUld,load:[{type:'REVIEWED',value:load}],dgStatus,needsReview:!edit.reviewed,reviewed:!!edit.reviewed};
 });
 const bulk=input.slice(parsed.rows.length);
 const allowedBulk=bulkPositionRules(req.flight.aircraft?.aircraftType).positions;
 if(bulk.length>allowedBulk.length)return res.status(400).json({error:'Too many BULK positions for aircraft '+(req.flight.aircraft?.aircraftType||'(unknown)')});
 const usedPositions=new Set(rows.map(row=>row.position));
 for(const edit of bulk){
  const position=String(edit?.position||'').trim().toUpperCase();
  if(!allowedBulk.includes(position))return res.status(400).json({error:'BULK position '+position+' is not allowed for aircraft '+(req.flight.aircraft?.aircraftType||'(unknown)')+'. Allowed: '+allowedBulk.join(', ')});
  if(usedPositions.has(position))return res.status(400).json({error:'Duplicate loading position: '+position});
  usedPositions.add(position);
  const load=String(edit.load||'').trim().toUpperCase();
  if(load.length>120)return res.status(400).json({error:'BULK load text too long'});
  const allowedTypes=new Set(['BAGGAGE','CREW_BAGS','MAIL','CARGO','BLANKETS','EQUIPMENT','OTHER']);
  let bulkItems=[];
  if(edit.bulkItems!==undefined){
   if(!Array.isArray(edit.bulkItems)||edit.bulkItems.length>30)return res.status(400).json({error:'BULK '+position+': up to 30 load items permitted'});
   for(const item of edit.bulkItems){
    const type=String(item?.type||'').toUpperCase();
    const details=String(item?.details||'').trim();
    const pieces=item?.pieces===''||item?.pieces==null?null:item.pieces;
    if(!allowedTypes.has(type))return res.status(400).json({error:'BULK '+position+': invalid load type'});
    if(details.length>120||(type==='OTHER'&&!details))return res.status(400).json({error:'BULK '+position+': specify details for Other (max 120 characters)'});
    if(pieces!==null&&(!Number.isInteger(pieces)||pieces<0||pieces>9999))return res.status(400).json({error:'BULK '+position+': piece count must be 0–9999'});
    bulkItems.push({type,pieces,details});
   }
  }else{
   // Older clients submitted three separate quantity fields; preserve those as items.
   for(const [field,type] of [['bulkMail','MAIL'],['bulkCargo','CARGO'],['bulkBaggage','BAGGAGE']]){
    const value=edit[field];
    if(value!==''&&value!=null&&(!Number.isInteger(value)||value<0||value>9999))return res.status(400).json({error:'Invalid BULK '+type+' pieces'});
    if(value!==''&&value!=null)bulkItems.push({type,pieces:value,details:''});
   }
  }
  // Populate legacy fields for clients that still display the older columns.
  const legacy={bulkMail:null,bulkCargo:null,bulkBaggage:null};
  for(const [field,type] of [['bulkMail','MAIL'],['bulkCargo','CARGO'],['bulkBaggage','BAGGAGE']]){
   const counts=bulkItems.filter(x=>x.type===type&&x.pieces!==null).map(x=>x.pieces);
   if(counts.length)legacy[field]=counts.reduce((a,b)=>a+b,0);
  }
  rows.push({position,plannedUld:'',uldType:'BULK',load:[{type:'REVIEWED',value:load}],...legacy,bulkItems,dgStatus:edit.dgStatus==='DG_PRESENT'?'DG_PRESENT':'UNKNOWN',needsReview:!edit.reviewed,reviewed:!!edit.reviewed});
 }
 // A flight has one checklist (unique turnaroundId). A new LIR revision replaces
 // its prior checklist; an upsert filtered by published:false would try to
 // INSERT a second checklist and fail with E11000 when the old one is published.
 const result=await Checklist.findOneAndUpdate(
  {turnaroundId:req.flight._id},
  {$set:{lirId:doc._id,revision:doc.revision,published:false,rows,version:0},
   $unset:{publishedBy:'',publishedAt:''}},
  {upsert:true,new:true,runValidators:true}
 );
 res.json({checklist:result});
});
router.post('/:flightId/checklist/publish',async(req,res)=>{
 if(!req.lirPermissions.upload)return res.status(403).json({error:'OPS only'});
 const doc=await latest(req.flight._id);if(!doc)return res.status(404).json({error:'No LIR'});
 const checklist=await Checklist.findOne({turnaroundId:req.flight._id,lirId:doc._id,published:false});
 if(!checklist||!checklist.rows.length||checklist.rows.some(row=>row.needsReview||!row.reviewed))return res.status(422).json({error:'Save and review every position before publishing'});
 checklist.published=true;checklist.publishedAt=new Date();checklist.publishedBy=req.user.name;
 await checklist.save();
 req.app.get('io').to(String(req.flight._id)).emit('lirChecklistUpdated',{revision:doc.revision});
 res.json({checklist});
});
// Confirm each physical BULK load separately; a change to an earlier confirmation is audited.
router.put('/:flightId/checklist/:position/bulk-items/:itemIndex',async(req,res)=>{
 if(!await canAnnotate(req.user,req.flight._id))return res.status(403).json({error:'Assigned RAMP only'});
 const doc=await latest(req.flight._id);
 if(!doc||doc.status==='COMPLETED')return res.status(409).json({error:'LIR completed or unavailable'});
 const position=String(req.params.position||'').toUpperCase();
 const index=Number(req.params.itemIndex);
 if(!/^(?:51|52|53|BULK)$/.test(position)||!Number.isSafeInteger(index)||index<0)return res.status(400).json({error:'Invalid BULK item'});
 const {expectedVersion,confirmed,reason}=req.body;
 if(!Number.isInteger(expectedVersion)||typeof confirmed!=='boolean')return res.status(400).json({error:'Refresh checklist and choose a confirmation status'});
 const checklist=await Checklist.findOne({turnaroundId:req.flight._id,lirId:doc._id,published:true,version:expectedVersion,'rows.position':position});
 if(!checklist)return res.status(409).json({error:'Checklist changed; refresh'});
 const row=checklist.rows.find(x=>x.position===position);
 if(!isBulkRow(row))return res.status(400).json({error:'This position is not BULK'});
 const allowed=bulkPositionRules(req.flight.aircraft?.aircraftType).positions;
 if(row.position!=='BULK'&&!allowed.includes(row.position))return res.status(409).json({error:'BULK position is invalid for aircraft; ask OPS to review'});
 // Previously published BULK rows may have separate legacy quantity columns.
 if(!row.bulkItems?.length){
  const legacy=[['bulkBaggage','BAGGAGE'],['bulkMail','MAIL'],['bulkCargo','CARGO']]
   .filter(([field])=>row[field]!=null).map(([field,type])=>({type,pieces:row[field],details:''}));
  if(legacy.length)row.bulkItems=legacy;
 }
 const item=row.bulkItems?.[index];
 if(!item)return res.status(404).json({error:'BULK load item not found'});
 const already=!!item.confirmedAt;
 if(already===confirmed)return res.status(409).json({error:confirmed?'This item is already confirmed':'This item is not confirmed'});
 const correctionReason=String(reason||'').trim();
 if(already&&(!correctionReason||correctionReason.length>300))return res.status(400).json({error:'A reason (max 300 characters) is required to remove a confirmation'});
 const before={confirmedAt:item.confirmedAt||null,confirmedBy:item.confirmedBy||null};
 const now=new Date();
 if(confirmed){item.confirmedAt=now;item.confirmedBy=req.user.name;}
 else{item.confirmedAt=null;item.confirmedBy=null;}
 // A position is no longer fully confirmed after an individual load is reopened.
 const wasPositionConfirmed=!!row.confirmedAt;
 if(!confirmed&&wasPositionConfirmed){row.confirmedAt=null;row.confirmedBy=null;}
 const history={action:confirmed?'CONFIRM_BULK_ITEM':'REOPEN_BULK_ITEM',position,itemIndex:index,
  itemLabel:item.type+(item.details?' · '+item.details:''),
  before,after:{confirmedAt:item.confirmedAt||null,confirmedBy:item.confirmedBy||null,positionReopened:!confirmed&&wasPositionConfirmed},
  reason:correctionReason,by:req.user.name,byId:req.user._id,at:now};
 const result=await Checklist.findOneAndUpdate({_id:checklist._id,version:expectedVersion},
  {$set:{rows:checklist.rows},$push:{history},$inc:{version:1}},{new:true,runValidators:true});
 if(!result)return res.status(409).json({error:'Another operator changed the checklist; refresh'});
 req.app.get('io').to(String(req.flight._id)).emit('lirChecklistUpdated',{revision:doc.revision});
 res.json({checklist:result});
});
router.put('/:flightId/checklist/:position',async(req,res)=>{
 if(!await canAnnotate(req.user,req.flight._id))return res.status(403).json({error:'Assigned RAMP only'});
 const doc=await latest(req.flight._id);if(!doc||doc.status==='COMPLETED')return res.status(409).json({error:'LIR completed or unavailable'});
 const position=String(req.params.position).toUpperCase();
 const actualPosition=String(req.body.actualPosition||'').trim().toUpperCase();
 const actualUld=String(req.body.actualUld||'').trim().toUpperCase();
 const bags=req.body.bags;
 if(!/^(?:[0-9]{2}[LPR]?|BULK)$/.test(position)||!/^(?:[0-9]{2}[LPR]?)$/.test(actualPosition))return res.status(400).json({error:'Valid loading position required'});
 if(bags!==null&&bags!==undefined&&(!Number.isInteger(bags)||bags<0||bags>999))return res.status(400).json({error:'Invalid bag count'});
 if(!Number.isInteger(req.body.expectedVersion))return res.status(400).json({error:'Refresh checklist before confirming'});
 const checklist=await Checklist.findOne({turnaroundId:req.flight._id,lirId:doc._id,published:true,version:req.body.expectedVersion,'rows.position':position});
 if(!checklist)return res.status(409).json({error:'Checklist changed; refresh'});
 const row=checklist.rows.find(r=>r.position===position);
 if(isBulkRow(row)){
  const allowedBulk=bulkPositionRules(req.flight.aircraft?.aircraftType).positions;
  if(!allowedBulk.includes(actualPosition))return res.status(400).json({error:'For aircraft '+(req.flight.aircraft?.aircraftType||'(unknown)')+', valid BULK positions: '+allowedBulk.join(', ')});
  if(row.position!=='BULK'&&!allowedBulk.includes(row.position))return res.status(409).json({error:'BULK loading plan does not match current aircraft type; ask OPS to review the LIR'});
  if(actualUld)return res.status(400).json({error:'BULK does not require a ULD number'});
  if(checklist.rows.some(r=>r.position!==position&&isBulkRow(r)&&r.confirmedAt&&r.actualPosition===actualPosition))
   return res.status(409).json({error:'Another BULK load was already confirmed in position '+actualPosition});
 }else if(!/^[A-Z]{3}[A-Z0-9]{5,12}$/.test(actualUld)){
  return res.status(400).json({error:'Valid ULD number required'});
 }
 if(isBulkRow(row)){
  // Do not allow an entire BULK hold to be confirmed with unchecked individual loads.
  const items=row.bulkItems?.length?row.bulkItems:
   [['bulkBaggage','BAGGAGE'],['bulkMail','MAIL'],['bulkCargo','CARGO']].filter(([field])=>row[field]!=null).map(([field,type])=>({type,pieces:row[field]}));
  if(items.some(item=>!item.confirmedAt))return res.status(409).json({error:'Confirm every individual BULK item before confirming the position'});
 }
 const openChange=await LoadingChange.exists({turnaroundId:req.flight._id,lirId:doc._id,status:{$in:['REQUESTED','AUTHORISED']},$or:[{from:position},{to:position}]});
 if(openChange)return res.status(409).json({error:'Loading change pending for this position. Complete the approved change before reconfirming.'});
 const hadConfirmation=!!row.confirmedAt;
 const correctionReason=String(req.body.correctionReason||'').trim();
 if(hadConfirmation&&(correctionReason.length<3||correctionReason.length>300))return res.status(400).json({error:'Please give a reason (3–300 characters) when correcting a confirmed position'});
 const before={actualPosition:row.actualPosition||null,actualUld:row.actualUld||'',bags:row.bags??null,
  confirmedAt:row.confirmedAt||null,confirmedBy:row.confirmedBy||null};
 const now=new Date();
 row.discrepancy=Boolean((row.plannedUld&&row.plannedUld!==actualUld)||(!isBulkRow(row)&&position!==actualPosition)||(isBulkRow(row)&&position!=='BULK'&&position!==actualPosition));
 row.actualPosition=actualPosition;row.actualUld=actualUld;row.bags=bags??null;row.confirmedAt=now;row.confirmedBy=req.user.name;
 const history={action:hadConfirmation?'CORRECT_POSITION':'CONFIRM_POSITION',position,before,
  after:{actualPosition,actualUld,bags:row.bags,confirmedAt:now,confirmedBy:req.user.name},
  reason:hadConfirmation?correctionReason:'',by:req.user.name,byId:req.user._id,at:now};
 const result=await Checklist.findOneAndUpdate({_id:checklist._id,version:req.body.expectedVersion},
  {$set:{rows:checklist.rows},$push:{history},$inc:{version:1}},{new:true,runValidators:true});
 if(!result)return res.status(409).json({error:'Another update occurred; refresh'});
 req.app.get('io').to(String(req.flight._id)).emit('lirChecklistUpdated',{revision:doc.revision});
 res.json({checklist:result});
});

const LoadingChange=require('../models/LirLoadingChange');
const validUld=value=>/^[A-Z]{3}[A-Z0-9]{5,12}$/.test(value);
router.get('/:flightId/checklist/changes',async(req,res)=>{
 const doc=await latest(req.flight._id);
 if(!doc)return res.json({changes:[],latestRevision:null,otherRevisionCount:0});
 const changes=await LoadingChange.find({turnaroundId:req.flight._id,lirId:doc._id}).sort({requestedAt:-1}).limit(100).lean();
 const otherRevisionCount=await LoadingChange.countDocuments({turnaroundId:req.flight._id,lirId:{$ne:doc._id}});
 res.json({changes,latestRevision:doc.revision,otherRevisionCount});
});
router.post('/:flightId/checklist/changes',async(req,res)=>{
 if(!await canAnnotate(req.user,req.flight._id))return res.status(403).json({error:'Assigned Departure RAMP only'});
 const doc=await latest(req.flight._id);
 if(!doc||doc.status==='COMPLETED')return res.status(409).json({error:'LIR is completed or unavailable'});
 const c=await Checklist.findOne({turnaroundId:req.flight._id,lirId:doc._id,published:true});
 if(!c)return res.status(409).json({error:'Published checklist required'});
 const action=String(req.body.action||'').toUpperCase(),from=String(req.body.from||'').toUpperCase(),to=String(req.body.to||'').toUpperCase();
 const replacementUld=String(req.body.replacementUld||'').trim().toUpperCase();
 const reason=String(req.body.reason||'').trim().slice(0,300);
 const source=c.rows.find(r=>r.position===from),target=c.rows.find(r=>r.position===to);
 if(!['SWAP','MOVE','REPLACE'].includes(action)||!source||!reason)return res.status(400).json({error:'Action, source and reason required'});
 if(action!=='REPLACE'&&(!target||to===from))return res.status(400).json({error:'Select a different existing destination position'});
 if(action==='REPLACE'&&!validUld(replacementUld))return res.status(400).json({error:'Valid replacement ULD required'});
 if(!source.actualUld&&!source.plannedUld)return res.status(422).json({error:'Source has no ULD'});
 if(action==='SWAP'&&!target.actualUld&&!target.plannedUld)return res.status(422).json({error:'Swap requires two ULDs'});
 if(action==='MOVE'&&(target.actualUld||target.plannedUld||target.confirmedAt))return res.status(422).json({error:'Destination is occupied; use Swap'});
 const affected=action==='REPLACE'?[from]:[from,to];
 const pending=await LoadingChange.exists({turnaroundId:req.flight._id,lirId:doc._id,status:{$in:['REQUESTED','AUTHORISED']},$or:[{from:{$in:affected}},{to:{$in:affected}}]});
 if(pending)return res.status(409).json({error:'A loading change is already open for one of these positions'});
 const change=await LoadingChange.create({turnaroundId:req.flight._id,lirId:doc._id,action,from,to:action==='REPLACE'?undefined:to,replacementUld:action==='REPLACE'?replacementUld:undefined,sourceUld:source.actualUld||source.plannedUld||'',destinationUld:target?(target.actualUld||target.plannedUld||''):'',reason,requestedBy:req.user.name});
 try { await addSystemMessage(req,req.flight._id,`⚠ LOADING CHANGE REQUESTED — ${action} ${from}${to?' → '+to:''}${replacementUld?' / '+replacementUld:''} — ${reason} — requested by ${req.user.name}. OPS: review in eLIR Loading Checklist.`); } catch(error){console.error('Loading change notification failed:',error.message);}
 req.app.get('io').to(String(req.flight._id)).emit('lirChecklistUpdated',{revision:doc.revision});
 res.status(201).json({change});
});
router.post('/:flightId/checklist/changes/:changeId/review',async(req,res)=>{
 if(!req.lirPermissions.upload)return res.status(403).json({error:'OPS only'});
 const doc=await latest(req.flight._id);
 if(!doc||doc.status==='COMPLETED')return res.status(409).json({error:'LIR completed or unavailable'});
 const decision=String(req.body.decision||'').toUpperCase();
 if(!['AUTHORISED','REJECTED'].includes(decision))return res.status(400).json({error:'Invalid decision'});
 const change=await LoadingChange.findOneAndUpdate({_id:req.params.changeId,turnaroundId:req.flight._id,lirId:doc._id,status:'REQUESTED'},{$set:{status:decision,reviewedBy:req.user.name,reviewedAt:new Date()}},{new:true});
 if(!change)return res.status(409).json({error:'Change no longer pending; refresh'});
 req.app.get('io').to(String(req.flight._id)).emit('lirChecklistUpdated',{revision:doc.revision});
 res.json({change});
});
router.post('/:flightId/checklist/changes/:changeId/execute',async(req,res)=>{
 if(!await canAnnotate(req.user,req.flight._id))return res.status(403).json({error:'Assigned Departure RAMP only'});
 const doc=await latest(req.flight._id);
 if(!doc||doc.status==='COMPLETED')return res.status(409).json({error:'LIR completed or unavailable'});
 const change=await LoadingChange.findOne({_id:req.params.changeId,turnaroundId:req.flight._id,lirId:doc._id,status:'AUTHORISED'});
 if(!change)return res.status(409).json({error:'Change is not authorised or is already executed'});
 const c=await Checklist.findOne({turnaroundId:req.flight._id,lirId:doc._id,published:true});
 if(!c||c.version!==req.body.expectedVersion)return res.status(409).json({error:'Checklist changed; refresh before executing'});
 const from=c.rows.find(r=>r.position===change.from),to=c.rows.find(r=>r.position===change.to);
 if(!from||(change.action!=='REPLACE'&&!to))return res.status(409).json({error:'Positions no longer available'});
 const sourceUld=from.actualUld||from.plannedUld||'',destUld=to&&(to.actualUld||to.plannedUld||'');
 if(!sourceUld)return res.status(409).json({error:'Source ULD missing'});
 if(change.action==='SWAP'&&!destUld)return res.status(409).json({error:'Swap destination ULD missing'});
 if(change.action==='MOVE'&&destUld)return res.status(409).json({error:'Move destination occupied'});
 if(change.action==='REPLACE'){from.actualUld=change.replacementUld;from.actualPosition=from.position;}
 if(change.action==='SWAP'){from.actualUld=destUld;to.actualUld=sourceUld;from.actualPosition=from.position;to.actualPosition=to.position;}
 if(change.action==='MOVE'){from.actualUld='';from.actualPosition=from.position;to.actualUld=sourceUld;to.actualPosition=to.position;}
 // Any changed position must be independently checked again by RAMP after execution.
 for(const row of [from,...(to?[to]:[])]){row.confirmedAt=undefined;row.confirmedBy=undefined;row.discrepancy=true;row.bags=undefined;}
 const result=await Checklist.findOneAndUpdate({_id:c._id,version:c.version},{$set:{rows:c.rows},$inc:{version:1}},{new:true,runValidators:true});
 if(!result)return res.status(409).json({error:'Another operator changed the checklist; refresh'});
 await LoadingChange.updateOne({_id:change._id,status:'AUTHORISED'},{$set:{status:'EXECUTED',executedBy:req.user.name,executedAt:new Date()}});
 req.app.get('io').to(String(req.flight._id)).emit('lirChecklistUpdated',{revision:doc.revision});
 res.json({checklist:result});
});
router.get('/:flightId/loading-preview', async (req,res) => {
 const doc=await latest(req.flight._id);
 if(!doc)return res.status(404).json({error:'No LIR uploaded'});
 if(doc.kind!=='text')return res.json({supported:false,reason:'PDF parsing is not available yet; original LIR and annotations remain available.'});
 const source=await Lir.findById(doc._id).select('+original');
 const raw=source.original.toString('utf8');
 if(!raw.includes('LOADING INSTRUCTION/REPORT') || !raw.includes(' TK '))return res.json({supported:false,reason:'Only TK text LIR is supported in this first preview.'});
 const parsed=require('../services/tkLirParser').parse(raw);
 res.json({supported:true,revision:doc.revision,...parsed});
});
router.get('/:flightId/:documentId', async (req,res) => {
  const doc = await Lir.findOne({ _id:req.params.documentId, turnaroundId:req.flight._id });
  if (!doc) return res.status(404).json({ error:'LIR not found' });
  res.json(doc);
});
router.get('/:flightId/:documentId/source', async (req,res) => {
  const doc = await Lir.findOne({ _id:req.params.documentId, turnaroundId:req.flight._id }).select('+original');
  if (!doc) return res.status(404).json({ error:'LIR not found' });
  res.set('X-Content-Type-Options','nosniff');
  res.set('Content-Disposition', `attachment; filename="${doc.filename}"`);
  res.type(doc.kind === 'pdf' ? 'application/pdf' : 'text/plain; charset=utf-8').send(doc.original);
});
router.post('/:flightId', async (req,res) => {
  if (!req.lirPermissions.upload) return res.status(403).json({ error:'Only OPS can upload a LIR' });
  let source;
  try { source = validate.source(req.body); }
  catch (error) { return res.status(400).json({ error:error.message }); }
  const expected = req.body.expectedSequence;
  const filter = { _id:req.flight._id, deleted:{ $ne:true } };
  if (expected === 0) filter.$or = [{ lirSequence:0 }, { lirSequence:{ $exists:false } }];
  else filter.lirSequence = expected;
  const flight = await Turnaround.findOneAndUpdate(filter, { $inc:{ lirSequence:1 } }, { new:true });
  if (!flight) return res.status(409).json({ error:'Another upload changed this flight. Refresh before uploading again.' });
  const doc = await Lir.create({ ...source, turnaroundId:flight._id, revision:flight.lirSequence,
    uploadedBy:req.user._id, uploadedByName:req.user.name });
  await notify(req, doc, `LIR v${doc.revision} uploaded by OPS — ready for RAMP`);
  res.status(201).json({ document:await Lir.findById(doc._id), sequence:flight.lirSequence });
});
router.put('/:flightId/:documentId/annotations', async (req,res) => {
  if (!await canAnnotate(req.user, req.flight._id)) return res.status(403).json({ error:'Only the RAMP agent assigned to this flight can annotate or sign its LIR' });
  let data;
  try { data = validate.annotations(req.body); }
  catch (error) { return res.status(400).json({ error:error.message }); }
  const current = await latest(req.flight._id);
  if (!current || String(current._id) !== req.params.documentId || current.status === 'COMPLETED') {
    return res.status(409).json({ error:'This LIR is superseded or completed. Refresh to view the latest version.' });
  }
  const update = { ...data, status:req.body.complete ? 'COMPLETED' : 'IN_PROGRESS',
    updatedBy:req.user._id, updatedByName:req.user.name };
  if (req.body.complete) Object.assign(update, { signedBy:req.user._id, signedByName:req.user.name, signedAt:new Date() });
  const doc = await Lir.findOneAndUpdate({ _id:current._id, turnaroundId:req.flight._id,
    annotationVersion:req.body.expectedVersion, status:{ $ne:'COMPLETED' } },
    { $set:update, $inc:{ annotationVersion:1 } }, { new:true, runValidators:true });
  if (!doc) return res.status(409).json({ error:'Another operator saved changes. Your local work is still open; refresh before editing again.' });
  await notify(req, doc, req.body.complete ? `LIR v${doc.revision} signed and completed by RAMP` : `LIR v${doc.revision} annotations saved by RAMP`);
  res.json(doc);
});
router.use((error,req,res,next) => {
  if (error.type === 'entity.too.large') return res.status(413).json({ error:'LIR upload is too large (5 MB document limit)' });
  if (error instanceof SyntaxError && error.status === 400) return res.status(400).json({ error:'Invalid JSON' });
  console.error('LIR request failed:',error.message);
  res.status(500).json({ error:'LIR could not be saved or loaded. Please refresh and try again.' });
});
module.exports = router;
