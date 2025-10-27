const mongoose = require('mongoose');

const CandidateSchema = new mongoose.Schema({
  candidateId: Number,
  name: String,
  party: {
    type: String, // Store party name directly
    required: true
  }
});

module.exports = mongoose.model("Candidate", CandidateSchema);
