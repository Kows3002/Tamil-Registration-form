const mongoose = require('mongoose')
const Family = require('../models/Family')
const Community = require('../models/Community')
const FormConfiguration = require('../models/FormConfiguration')
const collection = require('./familyCollection')
const { issueReceipt, hashReceiptToken } = require('../utils/receipt')
const { sendRegistrationPdf } = require('../utils/registrationPdf')

const { validMobile: cleanPhone } = require('../utils/phone')
const idFields = ['districtId', 'blockId', 'villagePanchayatId', 'habitationId', 'assemblyConstituencyId', 'postOfficeId', 'pincodeId']
const stripEmptyIds = payload => { for (const key of idFields) if (!payload[key]) delete payload[key] }
function normalizeField(field, value) {
  if (value === undefined || value === null || value === '') return value
  if (field.type === 'checkbox') return typeof value === 'boolean' ? value : null
  if (field.type === 'number') { const number = Number(value); return Number.isFinite(number) ? number : null }
  if (field.type === 'checkbox-group') {
    if (!Array.isArray(value) || value.some(item => !(field.options || []).includes(item)) || (value.includes('None') && value.length > 1)) return null
    return [...new Set(value)].join(', ')
  }
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (text.length > 5000) return null
  if (field.type === 'phone' && !cleanPhone(text)) return null
  if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return null
  if (field.type === 'select' && !(field.options || []).includes(text)) return null
  if (field.type === 'date' && Number.isNaN(Date.parse(text))) return null
  return text
}

exports.createFamily = async (req, res, next) => {
  try {
    const input = req.body || {}
    const slug = String(input.communitySlug || '').trim().toLowerCase()
    if (!slug) return res.status(400).json({ success: false, message: 'Open the registration link for your community before submitting.' })
    const community = await Community.findOne({ slug, status: 'ACTIVE', 'settings.allowPublicRegistration': true }).lean()
    if (!community) return res.status(404).json({ success: false, message: 'Registration for this community is unavailable.' })
    if (input.communityId && String(input.communityId) !== String(community._id)) return res.status(400).json({ success: false, message: 'The submitted community does not match this registration link.' })
    const configuration = await FormConfiguration.findOne({ communityId: community._id }).lean()
    const version = configuration?.versions.find(item => item.version === configuration.activeVersion && item.status === 'PUBLISHED')
    if (!version) return res.status(409).json({ success: false, message: 'This community has not published a registration form.' })
    const visibleFields = version.sections.filter(section => section.enabled).flatMap(section => section.fields.filter(field => field.visible))
    const payload = {}
    for (const field of visibleFields) {
      const value = input[field.key]
      if (field.required && (value === undefined || value === null || value === '' || (field.key === 'members' && !Array.isArray(input.members)))) {
        return res.status(400).json({ success: false, message: `${field.label} is required.` })
      }
      if (field.key === 'members') continue
      if (['support', 'contribution'].includes(field.type)) {
        payload[field.key] = collection.engagement(field.type, value)
        continue
      }
      const normalized = normalizeField(field, value)
      if (value !== undefined && value !== '' && normalized === null) return res.status(400).json({ success: false, message: `Enter a valid value for ${field.label}.` })
      if (field.required && (normalized === '' || normalized === false)) return res.status(400).json({ success: false, message: `${field.label} is required.` })
      if (normalized !== undefined && normalized !== '') {
        if (Family.schema.path(field.key)) payload[field.key] = normalized
        else { payload.customData ||= {}; payload.customData[field.key] = normalized }
      }
    }
    if (!String(payload.familyHeadName || '').trim() || !String(payload.district || '').trim() || !String(payload.villageName || '').trim()) return res.status(400).json({ success: false, message: 'Complete the required family and location details.' })
    payload.members = collection.members(input.members, community._id, { requireWorkLocation: version.templateKey === 'family-directory-v4' })
    Object.assign(payload, await collection.resolveLocation(input, visibleFields.some(field => field.type === 'location' && field.required), community._id))
    if (visibleFields.some(field => ['location', 'support', 'contribution'].includes(field.type))) {
      if (input.consent !== true) return res.status(400).json({ success: false, message: 'Confirm your consent before submitting your family details.' })
      payload.consent = true
      payload.consentAt = new Date()
    }
    stripEmptyIds(payload)
    const receipt = issueReceipt()
    const family = await Family.create({ ...payload, communityId: community._id, formVersion: version.version, status: 'PENDING', receiptTokenHash: receipt.hash, receiptExpiresAt: receipt.expiresAt })
    const saved = typeof family.toObject === 'function' ? family.toObject({ flattenMaps: true }) : { ...family }
    delete saved.receiptTokenHash; delete saved.receiptExpiresAt
    res.status(201).json({ success: true, data: { ...saved, receiptToken: receipt.token } })
  } catch (error) { next(error) }
}

exports.listFamilies = async (req, res, next) => {
  try {
    const filter = require('./reportController').filterFor(req.admin, {})
    if (req.communityId) filter.communityId = req.communityId
    const families = await Family.find(filter).sort({ createdAt: -1, _id: -1 }).lean()
    const communities = await Community.find({ _id: { $in: [...new Set(families.map(item => String(item.communityId)))] } }).select('name').lean()
    const names = new Map(communities.map(item => [String(item._id), item.name]))
    res.json({ success: true, data: families.map(item => ({ ...item, communityName: names.get(String(item.communityId)) || 'Unknown community' })) })
  } catch (error) { next(error) }
}

exports.getFamily = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid family record.' })
    const family = await Family.findOne({ _id: req.params.id, communityId: req.communityId, status: { $ne: 'ARCHIVED' } })
    if (!family) return res.status(404).json({ success: false, message: 'Family record not found.' })
    res.json({ success: true, data: family.toObject({ flattenMaps: true }) })
  } catch (error) { next(error) }
}

exports.updateFamily = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid family record.' })
    const payload = { ...req.body }
    for (const key of ['_id', 'communityId', 'formVersion', 'createdAt', 'updatedAt', 'status', 'archivedAt', 'receiptTokenHash', 'receiptExpiresAt']) delete payload[key]
    stripEmptyIds(payload)
    if (!Array.isArray(payload.members) || !payload.members.some(member => member && String(member.nameAddress || member.name || '').trim())) return res.status(400).json({ success: false, message: 'Add at least one family member.' })
    if (!cleanPhone(payload.phoneNumber) || !cleanPhone(payload.alternatePhone) || payload.members.some(member => member && (!cleanPhone(member.phoneNumber) || !cleanPhone(member.additionalPhone)))) return res.status(400).json({ success: false, message: 'Enter a valid 10-digit Indian mobile number, optionally prefixed with +91.' })
    payload.members = payload.members.filter(member => member && String(member.nameAddress || member.name || '').trim()).map((member, index) => ({ ...member, communityId: req.communityId, nameAddress: member.nameAddress || member.name, age: member.age === '' ? undefined : member.age, serialNumber: index + 1 }))
    const family = await Family.findOneAndUpdate({ _id: req.params.id, communityId: req.communityId, status: { $ne: 'ARCHIVED' } }, { $set: payload }, { new: true, runValidators: true })
    if (!family) return res.status(404).json({ success: false, message: 'Family record not found.' })
    res.json({ success: true, data: family })
  } catch (error) { next(error) }
}

exports.deleteFamily = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid family record.' })
    const family = await Family.findOneAndUpdate({ _id: req.params.id, communityId: req.communityId, status: { $ne: 'ARCHIVED' } }, { $set: { status: 'ARCHIVED', archivedAt: new Date() } }, { new: true })
    if (!family) return res.status(404).json({ success: false, message: 'Family record not found.' })
    res.json({ success: true, data: { id: family._id, status: family.status } })
  } catch (error) { next(error) }
}

exports.setVerification = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid family record.' })
    const { status, reason = '' } = req.body || {}
    if (!['VERIFIED', 'REJECTED', 'PENDING'].includes(status)) return res.status(400).json({ success: false, message: 'Choose verified, rejected, or pending status.' })
    if (status === 'REJECTED' && !String(reason).trim()) return res.status(400).json({ success: false, message: 'Add a reason before rejecting this registration.' })
    const update = { status, verifiedAt: status === 'VERIFIED' ? new Date() : undefined, verifiedBy: status === 'VERIFIED' ? req.admin._id : undefined, rejectionReason: status === 'REJECTED' ? String(reason).trim() : undefined }
    const family = await Family.findOneAndUpdate({ _id: req.params.id, communityId: req.communityId, status: { $ne: 'ARCHIVED' } }, { $set: update }, { new: true, runValidators: true }).lean()
    if (!family) return res.status(404).json({ success: false, message: 'Family record not found.' })
    res.json({ success: true, data: family })
  } catch (error) { next(error) }
}

exports.publicReceipt = async (req, res, next) => {
  try {
    const token = req.get('x-receipt-token') || ''
    if (!mongoose.isValidObjectId(req.params.id) || !/^[a-f0-9]{64}$/.test(token)) return res.status(403).json({ success: false, message: 'A valid registration receipt is required.' })
    const family = await Family.findOne({ _id: req.params.id, receiptTokenHash: hashReceiptToken(token), receiptExpiresAt: { $gt: new Date() }, status: { $ne: 'ARCHIVED' } }).lean()
    if (!family) return res.status(403).json({ success: false, message: 'This receipt has expired or is unavailable. Contact your community administrator for a copy.' })
    const community = await Community.findById(family.communityId).select('name slug').lean()
    if (!community) return res.status(404).json({ success: false, message: 'Community not found.' })
    sendRegistrationPdf(res, family, community)
  } catch (error) { next(error) }
}

exports.adminPdf = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid family record.' })
    const family = await Family.findOne({ _id: req.params.id, communityId: req.communityId, status: { $ne: 'ARCHIVED' } }).lean()
    if (!family) return res.status(404).json({ success: false, message: 'Family record not found.' })
    sendRegistrationPdf(res, family, req.community)
  } catch (error) { next(error) }
}
