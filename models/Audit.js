const mongoose = require('mongoose');
const AuditSchema = new mongoose.Schema({
  action: String,
  actor: String,
  details: mongoose.Schema.Types.Mixed,
  ts: { type: Date, default: Date.now },
});
module.exports = mongoose.model('Audit', AuditSchema);
