const express=require('express');
const router=express.Router();
const Airline=require('../models/AirlineDirectory');
const access=require('../services/departmentAccess');
router.use(require('../middleware/requireUser'));
const canEdit=u=>access.superAdmin(u)||access.dutyManager(u);
const allowedServices=['cargo','crewTransport','passengerBuses','catering','cleaning','fuel','waterToilet'];
const short=(v,max=500)=>typeof v==='string'&&v.length<=max;
router.get('/',async(req,res)=>{
 try{const rows=await Airline.find().sort({name:1}).lean();res.json(rows);}
 catch(e){res.status(500).json({error:'Unable to load airlines'});}
});
router.get('/:iata',async(req,res)=>{
 try{const row=await Airline.findOne({iata:String(req.params.iata).toUpperCase(),station:'LHR'}).lean();if(!row)return res.status(404).json({error:'Airline not found'});res.json(row);}
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
 try{const row=await Airline.findOneAndUpdate({iata,station:'LHR'},{$set:{name:b.name.trim(),icao:(b.icao||'').toUpperCase(),callsign:b.callsign||'',awbPrefix:b.awbPrefix||'',logoUrl:b.logoUrl||'',representatives:b.representatives,services,instructions,updatedBy:req.user._id}},{upsert:true,new:true,runValidators:true,setDefaultsOnInsert:true});res.json(row);}
 catch(e){res.status(400).json({error:'Unable to save airline'});}
});
module.exports=router;
