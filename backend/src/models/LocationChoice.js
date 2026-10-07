const mongoose = require('mongoose')
const schema = new mongoose.Schema({
  communityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Community', required: true },
  kind: { type: String, enum: ['taluk', 'village', 'ward', 'street'], required: true },
  nameEnglish: { type: String, trim: true, required: true, maxlength: 160, match: /^[\x20-\x7e]+$/ },
  districtId: { type: mongoose.Schema.Types.ObjectId, ref: 'District', required: true },
  blockId: { type: mongoose.Schema.Types.ObjectId, ref: 'Block' },
  villagePanchayatId: { type: mongoose.Schema.Types.ObjectId, ref: 'VillagePanchayat' },
  habitationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Habitation' },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
}, { timestamps: true })
schema.index({ communityId: 1, kind: 1, districtId: 1, nameEnglish: 1 }, { unique: true })
module.exports = mongoose.models.LocationChoice || mongoose.model('LocationChoice', schema)
