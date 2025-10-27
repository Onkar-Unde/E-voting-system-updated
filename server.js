require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const { ethers } = require('ethers');
const jwt = require('jsonwebtoken');

const Voter = require('./models/Voter');
const Candidate = require('./models/Candidate');
const Audit = require('./models/Audit');

const PORT = process.env.PORT || 4000;
const MONGO = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/evote';
const PROVIDER_URL = process.env.PROVIDER_URL || 'http://127.0.0.1:8545';
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const SERVER_SALT = process.env.SERVER_SALT || 'SOME_SALT';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'adminkey';
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_jwt_secret';
const JWT_EXP = process.env.JWT_EXP || '30m';

// Blockchain connection
const provider = new ethers.JsonRpcProvider(PROVIDER_URL);
const wallet = PRIVATE_KEY ? new ethers.Wallet(PRIVATE_KEY, provider) : null;
let contract = null;

try {
  const evotingArtifact = require('./artifacts/contracts/EVoting.sol/EVoting.json');
  if (CONTRACT_ADDRESS && wallet) {
    contract = new ethers.Contract(CONTRACT_ADDRESS, evotingArtifact.abi, wallet);
  }
} catch {
  console.warn("⚠ Contract ABI missing! Run: npx hardhat compile");
}

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(morgan('dev'));

mongoose.connect(MONGO).then(()=>console.log("✅ Mongo Connected"))
.catch(e=>console.log("❌ Mongo Error",e));

function makeIdentityHash(aadhaarHash, token) {
  return ethers.keccak256(ethers.toUtf8Bytes(`${SERVER_SALT}|${aadhaarHash}|${token}`));
}

function hashToken(token) {
  return ethers.keccak256(ethers.toUtf8Bytes(token));
}

function cosineSimilarity(a,b){
  let dot=0,na=0,nb=0;
  if(a.length!==b.length)return 0;
  for(let i=0;i<a.length;i++){ dot+=a[i]*b[i]; na+=a[i]*a[i]; nb+=b[i]*b[i]; }
  return dot/Math.sqrt(na*nb);
}

function requireAuth(req,res,next){
  const auth=req.headers.authorization;
  if(!auth) return res.status(401).json({error:"No token"});
  try{
    req.user = jwt.verify(auth.split(" ")[1], JWT_SECRET);
    next();
  }catch{
    return res.status(401).json({error:"Invalid/Expired token"});
  }
}

// ✅ Fog Node validation middleware
async function requireFogVerification(req,res,next){
  const voter = await Voter.findById(req.user.voterId);
  if(!voter || !voter.isVerifiedOnce){
    return res.status(403).json({error:"Biometric verification required"});
  }
  next();
}

/**
 ✅ Registration endpoint
*/
app.post('/api/register', async(req,res)=>{
  try{
    const {aadhaarHash, centerId, faceEmbedding, fingerprintSecret}=req.body;
    if(!aadhaarHash||!centerId||!faceEmbedding||!fingerprintSecret)
      return res.status(400).json({error:"Missing fields"});

    if(await Voter.findOne({aadhaarHash}))
      return res.status(400).json({ error:"Already registered" });

    const fingerprintHash = hashToken(fingerprintSecret);
    const identityHash = makeIdentityHash(aadhaarHash,fingerprintSecret);

    const tx = await contract.registerIdentity(identityHash);
    await tx.wait();

    await Voter.create({
      aadhaarHash, identityHash, fingerprintHash,
      faceEmbedding, registrationCenter:centerId,
      hasVoted:false
    });

    res.json({
      ok:true,
      message:"Registration success",
      txHash:tx.hash
    });
  }catch(e){
    res.status(500).json({error:"server error",details:e.message});
  }
});

/**
 ✅ Login with biometric
*/
app.post('/api/auth/login', async(req,res)=>{
  try{
    console.log("LOGIN REQ", req.headers);

    if(!req.headers["x-center-auth"])
      return res.status(403).json({error:"Login only allowed at Election Center"});

    const {aadhaarHash,faceEmbedding,fingerprintSecret}=req.body;
    if(!aadhaarHash||!faceEmbedding||!fingerprintSecret)
      return res.status(400).json({error:"Missing fields"});

    const voter = await Voter.findOne({aadhaarHash});
    if(!voter) return res.status(404).json({error:"Not registered"});

    const sim = cosineSimilarity(voter.faceEmbedding,faceEmbedding);
    if(sim < 0.80) return res.status(403).json({error:"Face mismatch",sim});

    if(hashToken(fingerprintSecret)!==voter.fingerprintHash)
      return res.status(403).json({error:"Fingerprint mismatch"});

    // ✅ Blockchain double check
    if(!await contract.isRegistered(voter.identityHash))
      return res.status(403).json({error:"Identity missing on blockchain"});

    // ✅ Mark Fog verification success
    voter.isVerifiedOnce = true;
    await voter.save();

    const token = jwt.sign(
      { voterId:voter._id.toString(), aadhaarHash:voter.aadhaarHash },
      JWT_SECRET, {expiresIn:JWT_EXP}
    );

    res.json({ok:true,jwt:token});
  }
  catch(e){ res.status(500).json({error:"server error",details:e.message}); }
});

/**
 ✅ Cast Vote
*/
app.post('/api/vote', requireAuth, requireFogVerification, async(req,res)=>{
  try{
    const voter = await Voter.findById(req.user.voterId);
    if(!voter) return res.status(404).json({error:"Voter missing"});

    if(voter.hasVoted) return res.status(400).json({error:"Already voted"});

    const count = Number(await contract.candidatesCount());

    if(req.body.candidateId<0 || req.body.candidateId>=count)
      return res.status(400).json({error:"Invalid candidate"});

    const tx = await contract.vote(
      parseInt(req.body.candidateId),
      voter.identityHash,
      {gasLimit:400000}
    );
    await tx.wait();

    voter.hasVoted=true;
    await voter.save();

    res.json({ok:true,message:"Vote recorded",txHash:tx.hash});
  }
  catch(e){ res.status(500).json({error:"server error",details:e.message}); }
});

/**
 ✅ Admin API
*/
app.get('/api/admin/candidates', async(req,res)=>{
  if(req.headers["x-api-key"]!==ADMIN_API_KEY)
    return res.status(401).json({error:"unauthorized"});
  res.json({candidates: await Candidate.find()});
});

app.post('/api/admin/addCandidate', async(req,res)=>{
  if(req.headers["x-api-key"]!==ADMIN_API_KEY)
    return res.status(401).json({error:"unauthorized"});

  const tx = await contract.addCandidate(req.body.name);
  await tx.wait();

  const id = Number(await contract.candidatesCount())-1;
  await Candidate.create({candidateId:id,name:req.body.name});
  res.json({ok:true,candidateId:id});
});

app.listen(PORT, ()=>console.log(`✅ Server running on ${PORT}`));
