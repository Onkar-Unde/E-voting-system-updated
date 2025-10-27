const mongoose = require('mongoose');

const VoterSchema = new mongoose.Schema({
  aadhaarHash: { type: String, required: true, unique: true },
  identityHash: { type: String, required: true, unique: true },
  fingerprintHash: { type: String, required: true },
  faceEmbedding: { type: [Number], required: true },
  registeredAt: { type: Date, default: Date.now },
  isVerifiedOnce: { type: Boolean, default: false },
  hasVoted: { type: Boolean, default: false },
  registrationCenter: { type: String },
  verificationLogs: [{ ts: Date, status: String, message: String }]
});

module.exports = mongoose.model('Voter', VoterSchema);
