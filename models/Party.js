const mongoose = require("mongoose");

const PartySchema = new mongoose.Schema({
  name: { type: String, required: true },
  leader: { type: String, required: true },
  symbol: { type: String, default: "🏛️" },
}, { timestamps: true });

module.exports = mongoose.model("Party", PartySchema);
