const express=require('express');
const router=express.Router();
const Airline=require('../models/AirlineDirectory');
const HandlingInstruction=require('../models/HandlingInstruction');
const access=require('../services/departmentAccess');
router.use(require('../middleware/requireUser'));
const canEdit=u=>access.superAdmin(u)||access.dutyManager(u);
const allowedServices=['cargo','crewTransport','passengerBuses','catering','cleaning','fuel','waterToilet'];
const short=(v,max=500)=>typeof v==='string'&&v.length<=max;
router.get('/',async(req,res)=>{
 try{const rows=await Airline.find().sort({name:1}).lean();res.json(rows);}
 catch(e){res.status(500).json({error:'Unable to load airlines'});}
});
router.get('/:iata/instructions',async(req,res)=>{
 const iata=String(req.params.iata).trim().toUpperCase();
 const aircraft=String(req.query.aircraftType||'').trim().toUpperCase();
 if(!/^[A-Z0-9]{2,3}$/.test(iata)|| (aircraft&&!/^[A-Z0-9_-]{1,20}$/.test(aircraft)))return res.status(400).json({error:'Invalid airline or aircraft'});
 try{
  const [items,airline]=await Promise.all([
   HandlingInstruction.find({airline:iata,active:true,aircraftType:{$in:['ALL',...(aircraft?[aircraft]:[])]}}).select('title body steps operation aircraftType department role type revision').sort({operation:1,title:1}).lean(),
   Airline.findOne({iata,station:'LHR'}).select('instructions').lean()
  ]);
  res.set('Cache-Control','no-store').json({items,legacy:airline?.instructions||{}});
 }catch(e){res.status(500).json({error:'Unable to load instructions'});}
});
router.get('/:iata/logo',async(req,res)=>{
 try{
  const row=await Airline.findOne({iata:String(req.params.iata).toUpperCase(),station:'LHR'}).select('logoData').lean();
  if(!row?.logoData)return res.status(404).end();
  const match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(row.logoData);
  if(!match)return res.status(404).end();
  res.set('Content-Type','image/'+match[1]);res.set('Cache-Control','private, max-age=300');
  res.send(Buffer.from(match[2],'base64'));
 }catch(e){res.status(500).end();}
});
router.put('/:iata/logo',async(req,res)=>{
 if(!canEdit(req.user))return res.status(403).json({error:'Manager access required'});
 const iata=String(req.params.iata).toUpperCase();
 if(!/^[A-Z0-9]{2,3}$/.test(iata))return res.status(400).json({error:'Invalid IATA code'});
 const data=req.body?.image;
 if(typeof data!=='string'||data.length>250000)return res.status(400).json({error:'Image too large'});
 const match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(data);
 if(!match)return res.status(400).json({error:'PNG, JPG or WebP required'});
 const bytes=Buffer.from(match[2],'base64');
 if(bytes.length>180000||bytes.length<20)return res.status(400).json({error:'Image must be under 180 KB'});
 const valid=match[1]==='png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):match[1]==='jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
 if(!valid)return res.status(400).json({error:'Invalid image file'});
 try{
  const row=await Airline.findOneAndUpdate({iata,station:'LHR'},{$set:{logoData:data,logoUrl:'',updatedBy:req.user._id}},{new:true});
  if(!row)return res.status(404).json({error:'Save the airline first'});
  res.json({ok:true});
 }catch(e){res.status(500).json({error:'Unable to upload logo'});}
});
router.delete('/:iata/logo',async(req,res)=>{
 if(!canEdit(req.user))return res.status(403).json({error:'Manager access required'});
 const row=await Airline.findOneAndUpdate({iata:String(req.params.iata).toUpperCase(),station:'LHR'},{$unset:{logoData:1},$set:{updatedBy:req.user._id}});
 if(!row)return res.status(404).json({error:'Airline not found'});
 res.json({ok:true});
});
router.get('/:iata',async(req,res)=>{
 try{const row=await Airline.findOne({iata:String(req.params.iata).toUpperCase(),station:'LHR'}).select('+logoData').lean();if(!row)return res.status(404).json({error:'Airline not found'});res.json(row);}
 catch(e){res.status(500).json({error:'Unable to load airline'});}
});
router.put('/:iata',async(req,res)=>{
 if(!canEdit(req.user))return res.status(403).json({error:'Manager access required'});
 const b=req.body||{},iata=String(req.params.iata).toUpperCase();
 if(!/^[A-Z0-9]{2,3}$/.test(iata)||!short(b.name,120)||!b.name.trim()||!short(b.icao||'',4)||!short(b.callsign||'',80)||!short(b.awbPrefix||'',5)||!short(b.logoUrl||'',500))return res.status(400).json({error:'Invalid airline details'});
 if(b.logoUrl&&!/^https:\/\//i.test(b.logoUrl))return res.status(400).json({error:'Logo must use HTTPS'});
 if(!Array.isArray(b.representatives)||b.representatives.length>30)return res.status(400).json({error:'Invalid representatives'});
 if(b.representatives.some(x=>!x||!['name','position','phone','email','notes'].every(k=>short(x[k]||'',500))))return res.status(400).json({error:'Invalid contact'});
 const services=b.services||{};if(!services||Array.isArray(services)||typeof services!=='object'||Object.keys(services).some(k=>!allowedServices.includes(k)))return res.status(400).json({error:'Invalid services'});
 if(Object.values(services).some(x=>!x||typeof x!=='object'||!['provider','contact','phone','backupPhone','notes'].every(k=>short(x[k]||'',1500))))return res.status(400).json({error:'Invalid service details'});
 const instructions=b.instructions||{};if(!['arrival','departure','aircraft','general'].every(k=>short(instructions[k]||'',10000)))return res.status(400).json({error:'Invalid instructions'});
 try{const row=await Airline.findOneAndUpdate({iata,station:'LHR'},{$set:{name:b.name.trim(),icao:(b.icao||'').toUpperCase(),callsign:b.callsign||'',awbPrefix:b.awbPrefix||'',logoUrl:b.logoUrl||'',representatives:b.representatives,services,updatedBy:req.user._id}},{upsert:true,new:true,runValidators:true,setDefaultsOnInsert:true});res.json(row);}
 catch(e){res.status(400).json({error:'Unable to save airline'});}
});
module.exports=router;
