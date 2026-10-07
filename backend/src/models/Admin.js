const mongoose = require('mongoose')
const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['SUPER_ADMIN', 'COMMUNITY_ADMIN', 'COMMUNITY_MANAGER', 'DATA_ENTRY_OPERATOR', 'VERIFIER', 'VIEWER'], default: 'COMMUNITY_ADMIN', index: true },
  communityIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Community', index: true }],
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true },
}, { timestamps: true })
module.exports = mongoose.model('Admin', adminSchema)
