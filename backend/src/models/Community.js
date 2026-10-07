const mongoose = require('mongoose')

const communitySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  code: { type: String, required: true, trim: true, uppercase: true, match: /^[A-Z0-9-]{2,24}$/ },
  slug: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
  description: { type: String, trim: true, maxlength: 1000, default: '' },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true },
  branding: {
    primaryColor: { type: String, default: '#2457c5', match: /^#[0-9a-fA-F]{6}$/ },
    secondaryColor: { type: String, default: '#e9efff', match: /^#[0-9a-fA-F]{6}$/ },
    logoUrl: { type: String, default: '' },
  },
  contact: { name: String, phone: String, email: String, address: String },
  settings: { allowPublicRegistration: { type: Boolean, default: true }, defaultLanguage: { type: String, default: 'en' } },
}, { timestamps: true })

communitySchema.index({ code: 1 }, { unique: true })
module.exports = mongoose.models.Community || mongoose.model('Community', communitySchema)
