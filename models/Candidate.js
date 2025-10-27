const mongoose = require('mongoose');
const CandidateSchema = new mongoose.Schema({
  candidateId: { type: String, unique: true },
  name: { type: String, required: true }
});
module.exports = mongoose.model('Candidate', CandidateSchema);
