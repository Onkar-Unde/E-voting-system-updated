const mongoose = require("mongoose");

const VoteSchema = new mongoose.Schema({
  voter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Voter",
    required: true,
    unique: true // ✅ One vote per voter
  },
  candidateId: {
    type: Number,
    required: true
  },
  candidateName: {
    type: String,
    required: true
  },
  votingCenter: {
    type: String,
    required: true
  },
  txHash: {
    type: String,
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model("Vote", VoteSchema);
