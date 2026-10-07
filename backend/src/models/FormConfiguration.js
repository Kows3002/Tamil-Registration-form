const mongoose = require('mongoose')

const fieldSchema = new mongoose.Schema({
  key: { type: String, required: true, trim: true, match: /^[a-z][a-zA-Z0-9_]{1,63}$/ },
  label: { type: String, required: true, trim: true, maxlength: 120 },
  type: { type: String, enum: ['text', 'textarea', 'number', 'phone', 'email', 'date', 'select', 'checkbox', 'location', 'members', 'support', 'contribution'], default: 'text' },
  required: { type: Boolean, default: false },
  visible: { type: Boolean, default: true },
  helpText: { type: String, trim: true, maxlength: 300, default: '' },
  placeholder: { type: String, trim: true, maxlength: 120, default: '' },
  options: [{ type: String, trim: true, maxlength: 120 }],
  order: { type: Number, default: 0 },
}, { _id: true })

const sectionSchema = new mongoose.Schema({
  key: { type: String, required: true, trim: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 300, default: '' },
  enabled: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
  fields: { type: [fieldSchema], default: [] },
}, { _id: true })

const versionSchema = new mongoose.Schema({
  templateKey: String,
  version: { type: Number, required: true },
  status: { type: String, enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'], default: 'DRAFT' },
  sections: { type: [sectionSchema], default: [] },
  publishedAt: Date,
}, { timestamps: true })

const formConfigurationSchema = new mongoose.Schema({
  communityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Community', required: true },
  name: { type: String, default: 'Family Registration' },
  versions: { type: [versionSchema], default: [] },
  activeVersion: { type: Number, default: 1 },
  settings: { allowDrafts: { type: Boolean, default: true }, collectDocuments: { type: Boolean, default: false }, collectContributions: { type: Boolean, default: false }, collectHelpRequests: { type: Boolean, default: false } },
}, { timestamps: true })

formConfigurationSchema.index({ communityId: 1 }, { unique: true })
module.exports = mongoose.models.FormConfiguration || mongoose.model('FormConfiguration', formConfigurationSchema)
