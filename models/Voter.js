const mongoose = require('mongoose');

const VoterSchema = new mongoose.Schema({
  aadhaarHash: {
    type: String,
    required: true,
    unique: true
  },
  identityHash: {
    type: String,
    required: true
  },
  fingerprintHash: {
    type: String,
    required: true
  },
  faceEmbedding: {
    type: [Number], // Array of numbers
    default: []
  },
  registrationCenter: {
    type: String,
    default: "CENTER-001"
  },
  hasVoted: {
    type: Boolean,
    default: false
  },

  // Personal Details
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  dob: {
    type: String,
    required: true
  },
  address: {
    type: String,
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model("Voter", VoterSchema);
