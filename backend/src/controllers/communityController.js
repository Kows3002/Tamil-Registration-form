const Community = require('../models/Community')
const FormConfiguration = require('../models/FormConfiguration')
const SYSTEM_FIELD_KEYS = new Set(['familyHeadName', 'district', 'villageName', 'members'])

const starterSections = [
  { key: 'family', title: 'Family details', description: 'Tell us about your household.', order: 1, fields: [
    { key: 'familyHeadName', label: 'Family name', type: 'text', required: true, order: 1 },
    { key: 'phoneNumber', label: 'Contact phone', type: 'phone', required: true, order: 2 },
  ] },
  { key: 'location', title: 'Location', description: 'Where your family lives.', order: 2, fields: [
    { key: 'district', label: 'District', type: 'text', required: true, order: 1 },
    { key: 'villageName', label: 'Village or town', type: 'text', required: true, order: 2 },
    { key: 'pitagaiName', label: 'Local area', type: 'text', required: false, order: 3 },
  ] },
  { key: 'members', title: 'Family members', description: 'Add the people in your household.', order: 3, fields: [
    { key: 'members', label: 'Family members', type: 'textarea', helpText: 'Add one member name on each line.', required: true, order: 1 },
  ] },
]
const defaultSections = require('../config/communityForm')
const priorSections = require('../config/legacyCommunityForm.json')
const previousDirectory = require('../config/communityFormV3.json')
const templateKey = 'family-directory-v4'
const signature = sections => JSON.stringify(sections.map(section => ({ key: section.key, title: section.title, description: section.description || '', enabled: section.enabled !== false, order: section.order, fields: section.fields.map(field => ({ key: field.key, label: field.label, type: field.type, required: Boolean(field.required), visible: field.visible !== false, helpText: field.helpText || '', placeholder: field.placeholder || '', order: field.order, options: Array.from(field.options || []) })) })))

function toSlug(value) {
  return String(value || '').normalize('NFKD').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50)
}

async function ensureForm(communityId) {
  const form = await FormConfiguration.findOneAndUpdate({ communityId }, { $setOnInsert: { communityId, name: 'Family Registration', activeVersion: 1, versions: [{ version: 1, templateKey, status: 'PUBLISHED', publishedAt: new Date(), sections: defaultSections }] } }, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true })
  const active = form.versions.find(version => version.version === form.activeVersion)
  // Upgrade only the untouched starter; preserve administrator-authored forms and historical versions.
  const untouchedStarter = form.versions.length === 1 && active?.sections.length === starterSections.length && active.sections.every((section, index) => {
    const original = starterSections[index]
    return section.key === original.key && section.title === original.title && section.enabled && section.fields.length === original.fields.length && section.fields.every((item, i) => item.key === original.fields[i].key && item.label === original.fields[i].label && item.type === original.fields[i].type && item.required === original.fields[i].required && item.visible)
  })
  const untouchedDirectory = active && [priorSections, previousDirectory].some(sections => signature(active.sections) === signature(sections)) && !form.versions.some(version => version.status === 'DRAFT')
  if (active?.templateKey !== templateKey && (untouchedStarter || untouchedDirectory)) {
    active.status = 'ARCHIVED'
    const number = Math.max(...form.versions.map(version => version.version)) + 1
    form.versions.push({ version: number, templateKey, status: 'PUBLISHED', publishedAt: new Date(), sections: defaultSections })
    form.activeVersion = number
    await form.save()
  }
  return form
}
exports.ensureForm = ensureForm
exports.defaultSections = defaultSections

exports.list = async (req, res, next) => {
  try {
    const filter = req.admin.role === 'SUPER_ADMIN' ? {} : { _id: { $in: req.admin.communityIds } }
    const communities = await Community.find(filter).sort({ name: 1 }).lean()
    res.json({ success: true, data: communities })
  } catch (error) { next(error) }
}

exports.create = async (req, res, next) => {
  try {
    const { name, code, description = '', primaryColor, secondaryColor, contact = {} } = req.body || {}
    if (typeof name !== 'string' || !name.trim() || typeof code !== 'string' || !/^[A-Za-z0-9-]{2,24}$/.test(code.trim())) return res.status(400).json({ success: false, message: 'Provide a community name and a 2–24 character code.' })
    const slug = toSlug(req.body.slug || name)
    if (!slug) return res.status(400).json({ success: false, message: 'Community name must contain English letters or numbers to create its public URL.' })
    const community = await Community.create({ name: name.trim(), code: code.trim().toUpperCase(), slug, description, branding: { primaryColor, secondaryColor }, contact })
    await ensureForm(community._id)
    res.status(201).json({ success: true, data: community })
  } catch (error) { next(error) }
}

exports.publicList = async (req, res, next) => {
  try {
    const communities = await Community.find({ status: 'ACTIVE', 'settings.allowPublicRegistration': true }).select('name slug').sort({ name: 1 }).lean()
    res.json({ success: true, data: communities })
  } catch (error) { next(error) }
}

exports.publicBySlug = async (req, res, next) => {
  try {
    const community = await Community.findOne({ slug: req.params.slug.toLowerCase(), status: 'ACTIVE', 'settings.allowPublicRegistration': true }).lean()
    if (!community) return res.status(404).json({ success: false, message: 'Registration for this community is unavailable.' })
    const form = (await ensureForm(community._id)).toObject()
    const active = form?.versions.find(version => version.version === form.activeVersion && version.status === 'PUBLISHED')
    res.json({ success: true, data: { community: { _id: community._id, name: community.name, slug: community.slug, branding: community.branding }, form: active || null } })
  } catch (error) { next(error) }
}

exports.update = async (req, res, next) => {
  try {
    const allowed = req.admin.role === 'SUPER_ADMIN' ? ['name', 'description', 'status', 'branding', 'contact', 'settings'] : ['name', 'description', 'branding', 'contact']
    const changes = Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => allowed.includes(key)))
    if (changes.branding) {
      changes.branding = Object.fromEntries(Object.entries(changes.branding).filter(([key]) => ['primaryColor', 'secondaryColor', 'logoUrl'].includes(key)))
      for (const key of ['primaryColor', 'secondaryColor']) if (changes.branding[key] && !/^#[0-9a-fA-F]{6}$/.test(changes.branding[key])) return res.status(400).json({ success: false, message: `${key} must use a six-digit hex value.` })
    }
    const communityId = req.params.id || req.params.communityId
    const scope = req.admin.role === 'SUPER_ADMIN' ? { _id: communityId } : { _id: req.communityId }
    const community = await Community.findOneAndUpdate(scope, { $set: changes }, { new: true, runValidators: true })
    if (!community) return res.status(404).json({ success: false, message: 'Community not found.' })
    res.json({ success: true, data: community })
  } catch (error) { next(error) }
}

exports.getForm = async (req, res, next) => {
  try {
    const form = await ensureForm(req.communityId)
    res.json({ success: true, data: form })
  } catch (error) { next(error) }
}

exports.saveDraft = async (req, res, next) => {
  try {
    const { sections } = req.body || {}
    if (!Array.isArray(sections) || sections.length > 30) return res.status(400).json({ success: false, message: 'A form must contain a valid list of sections.' })
    const keys = new Set()
    for (const section of sections) {
      if (!section.title?.trim() || !Array.isArray(section.fields)) return res.status(400).json({ success: false, message: 'Every section needs a title and a list of fields.' })
      for (const field of section.fields) {
        const structuredKeys = { location: 'district', members: 'members', support: 'support', contribution: 'contribution' }
        if (structuredKeys[field.type] && structuredKeys[field.type] !== field.key) return res.status(400).json({ success: false, message: `The ${field.type} field must use the key "${structuredKeys[field.type]}".` })
        if (['_id', 'communityId', 'formVersion', 'status', 'archivedAt', 'verifiedAt', 'verifiedBy', 'rejectionReason', 'createdAt', 'updatedAt', 'customData', 'consentAt', 'receiptTokenHash', 'receiptExpiresAt'].includes(field.key)) return res.status(400).json({ success: false, message: 'This field key is reserved for registration management.' })
        if (!field.key || !field.label?.trim() || keys.has(field.key)) return res.status(400).json({ success: false, message: 'Field keys must be unique and every field needs a label.' })
        keys.add(field.key)
      }
    }
    const requiredSystemKeys = ['familyHeadName', 'district', 'villageName', 'members']
    for (const key of requiredSystemKeys) if (!keys.has(key)) return res.status(400).json({ success: false, message: `The system field "${key}" must remain in the registration form.` })
    const form = await ensureForm(req.communityId)
    const number = Math.max(0, ...form.versions.map(v => v.version)) + 1
    const active = form.versions.find(version => version.version === form.activeVersion)
    form.versions.push({ version: number, templateKey: active?.templateKey, status: 'DRAFT', sections })
    await form.save()
    res.json({ success: true, data: form })
  } catch (error) { next(error) }
}

exports.publishForm = async (req, res, next) => {
  try {
    const form = await FormConfiguration.findOne({ communityId: req.communityId })
    const version = form?.versions.id(req.params.versionId)
    if (!version || version.status !== 'DRAFT') return res.status(404).json({ success: false, message: 'Draft form version not found.' })
    const issues = []
    const visibleKeys = new Set(version.sections.filter(section => section.enabled).flatMap(section => section.fields.filter(field => field.visible).map(field => field.key)))
    for (const key of SYSTEM_FIELD_KEYS) if (!visibleKeys.has(key)) issues.push(`The required system field "${key}" must be visible.`)
    if (!version.sections.some(section => section.enabled && section.fields.some(field => field.visible))) issues.push('Add an enabled section with at least one visible field.')
    for (const section of version.sections) for (const field of section.fields) if (field.visible && !field.label.trim()) issues.push('Every visible field needs a label.')
    if (issues.length) return res.status(400).json({ success: false, message: 'Fix the form validation issues before publishing.', data: { issues } })
    const previous = form.versions.find(item => item.version === form.activeVersion && item.status === 'PUBLISHED')
    if (previous) previous.status = 'ARCHIVED'
    version.status = 'PUBLISHED'
    version.publishedAt = new Date()
    form.activeVersion = version.version
    await form.save()
    res.json({ success: true, data: form })
  } catch (error) { next(error) }
}
