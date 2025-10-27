require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const { ethers } = require('ethers');
const jwt = require('jsonwebtoken');

const Voter = require('./models/Voter');
const Vote = require("./models/Vote");
const Candidate = require('./models/Candidate');
const Audit = require('./models/Audit');
const Party = require("./models/Party");


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
  try {
    const { fingerprintId, faceScanVerified } = req.body;

    if (!fingerprintId)
      return res.status(403).json({ error: "Fingerprint missing" });

    const voter = await Voter.findById(req.user.id);
    if (!voter) return res.status(404).json({ error: "Voter not found" });

    // ✅ Validate Fingerprint
    if (hashToken(fingerprintId) !== voter.fingerprintHash)
      return res.status(403).json({ error: "Fingerprint mismatch ❌" });

    // ✅ Validate Face (UI already confirms)
    if (!faceScanVerified)
      return res.status(403).json({ error: "Facial verification failed ❌" });

    console.log("Biometric + Face ✅ Verified");
    next();

  } catch (e) {
    res.status(500).json({ error: "Biometric verification error", details: e.message });
  }
}

/**
 ✅ Registration endpoint
*/
app.post('/api/register', async (req, res) => {
  try {
    const {
      aadhaar, name, email, phone, dob, address, fingerprintId
    } = req.body;

    if (!aadhaar || !name || !email || !phone || !dob || !address || !fingerprintId)
      return res.status(400).json({ error: "All fields required" });

    // Hash Aadhaar Number
    const aadhaarHash = ethers.keccak256(ethers.toUtf8Bytes(aadhaar));

    // Check duplicate Voter
    const exist = await Voter.findOne({
      $or: [{ aadhaarHash }, { phone }, { email }]
    });
    if (exist) return res.status(400).json({ error: "Already registered" });

    const fingerprintSecret = fingerprintId;
    const fingerprintHash = hashToken(fingerprintSecret);

    const faceEmbedding = [0.15, 0.27, 0.33, 0.42];

    const identityHash = makeIdentityHash(aadhaarHash, fingerprintSecret);

    if (!contract)
      return res.status(500).json({ error: "Blockchain not configured" });

    // ✅ Store on Blockchain
    const tx = await contract.registerIdentity(identityHash);
    await tx.wait();

    await Voter.create({
      aadhaarHash,
      identityHash,
      fingerprintHash,
      faceEmbedding,
      registrationCenter: "CENTER-001",
      hasVoted: false,
      name,
      email,
      phone,
      dob,
      address
    });

    return res.json({
      ok: true,
      message: "Registration success ✅ Stored on Blockchain",
      txHash: tx.hash
    });

  } catch (err) {
    console.error("register error", err);
    res.status(500).json({ error: "server error", details: err.message });
  }
});


/**
 ✅ Login with biometric
*/
app.post('/api/auth/login', async (req, res) => {
  try {
    console.log("LOGIN REQ");

    const { aadhaar, fingerprintId } = req.body;

    if (!aadhaar || !fingerprintId)
      return res.status(400).json({ error: "Aadhaar & Fingerprint required" });

    // ✅ Aadhaar hash lookup
    const aadhaarHash = ethers.keccak256(ethers.toUtf8Bytes(aadhaar));
    const voter = await Voter.findOne({ aadhaarHash });

    if (!voter)
      return res.status(404).json({ error: "Not registered" });

    // ✅ Fingerprint hash match
    const fingerprintHash = hashToken(fingerprintId);

    if (fingerprintHash !== voter.fingerprintHash) {
      return res.status(403).json({ error: "Fingerprint mismatch" });
    }

    console.log("Biometric Verified ✅");

    // ✅ Blockchain identity check
    const registered = await contract.isRegistered(voter.identityHash);
    if (!registered)
      return res.status(403).json({ error: "Identity not on blockchain" });

    // ✅ Generate JWT token
    const token = jwt.sign(
      { id: voter._id, aadhaarHash: voter.aadhaarHash },
      JWT_SECRET,
      { expiresIn: "2h" }
    );

    return res.json({
      ok: true,
      message: "Biometric Login Success ✅",
      token
    });

  } catch (err) {
    console.error("LOGIN ERR", err);
    res.status(500).json({ error: "Server Error", details: err.message });
  }
});


/**
 ✅ Cast Vote
*/
app.post('/api/vote', requireAuth, requireFogVerification, async (req, res) => {
  try {
    const voter = await Voter.findById(req.user.id);
    if (!voter) return res.status(404).json({ error: "Voter missing" });

    if (voter.hasVoted)
      return res.status(400).json({ error: "Already voted" });

    const count = Number(await contract.candidatesCount());
    const candidateId = parseInt(req.body.candidateId);

    if (candidateId < 0 || candidateId >= count)
      return res.status(400).json({ error: "Invalid candidate" });

    const candidate = await Candidate.findOne({ candidateId });
    if (!candidate)
      return res.status(404).json({ error: "Candidate not found" });

    const tx = await contract.vote(
      candidateId,
      voter.identityHash,
      { gasLimit: 400000 }
    );
    await tx.wait();

    voter.hasVoted = true;
    await voter.save();

    await Vote.create({
      voter: voter._id,
      candidateId,
      candidateName: candidate.name,
      votingCenter: voter.registrationCenter,
      txHash: tx.hash
    });

    res.json({
      ok: true,
      message: "Vote recorded ✅",
      txHash: tx.hash
    });

  } catch (e) {
    console.error("Vote Error:", e);
    res.status(500).json({ error: "server error", details: e.message });
  }
});

app.get("/api/results", async (req, res) => {
  try {
    const results = await Vote.aggregate([
      {
        $group: {
          _id: "$candidateName",
          totalVotes: { $sum: 1 }
        }
      },
      { $sort: { totalVotes: -1 } }
    ]);

    res.json({
      ok: true,
      results
    });

  } catch (e) {
    console.error("Results Error:", e);
    res.status(500).json({ error: "server error", details: e.message });
  }
});

app.get("/api/results/center/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const results = await Vote.aggregate([
      { $match: { votingCenter: id } },
      {
        $group: {
          _id: "$candidateName",
          totalVotes: { $sum: 1 }
        }
      },
      { $sort: { totalVotes: -1 } }
    ]);

    res.json({
      ok: true,
      votingCenter: id,
      results
    });

  } catch (e) {
    console.error("Center Results Error:", e);
    res.status(500).json({ error: "server error", details: e.message });
  }
});
// ✅ Get all parties
app.get('/api/admin/parties', async (req, res) => {
  if (req.headers["x-api-key"] !== ADMIN_API_KEY)
    return res.status(401).json({ error: "unauthorized" });

  res.json({ parties: await Party.find() });
});

// ✅ Add Party
app.post('/api/admin/addParty', async (req, res) => {
  if (req.headers["x-api-key"] !== ADMIN_API_KEY)
    return res.status(401).json({ error: "unauthorized" });

  const { name, leader, symbol } = req.body;
  const party = await Party.create({ name, leader, symbol });

  res.json({ ok: true, party });
});

/**
 ✅ Admin API
*/

app.get('/api/admin/candidates', async (req, res) => {
  if (req.headers["x-api-key"] !== ADMIN_API_KEY)
    return res.status(401).json({ error: "unauthorized" });

  res.json({ candidates: await Candidate.find().populate("party") });
});

app.post('/api/admin/addCandidate', async (req, res) => {
  if (req.headers["x-api-key"] !== ADMIN_API_KEY)
    return res.status(401).json({ error: "unauthorized" });

  const { name, party } = req.body;

  const tx = await contract.addCandidate(name);
  await tx.wait();

  const id = Number(await contract.candidatesCount()) - 1;

  const candidate = await Candidate.create({
    candidateId: id,
    name,
    party
  });
  res.json({ ok: true, candidate });
});

app.listen(PORT, ()=>console.log(`✅ Server running on ${PORT}`));
