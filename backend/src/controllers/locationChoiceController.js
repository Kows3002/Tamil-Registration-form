const mongoose = require('mongoose')
const LocationChoice = require('../models/LocationChoice')
const Community = require('../models/Community')
const { District, Block, VillagePanchayat, Habitation } = require('../models/MasterData')
const { mergeTaluks } = require('../config/taluks')
const kinds = ['taluk', 'village', 'ward', 'street']
exports.list = async (req, res, next) => {
  try {
    const { communitySlug, kind, districtId } = req.query
    if (!kinds.includes(kind) || !mongoose.isValidObjectId(districtId)) return res.status(400).json({ success: false, message: 'Choose a district and a valid location list.' })
    const community = await Community.findOne({ slug: String(communitySlug || ''), status: 'ACTIVE', 'settings.allowPublicRegistration': true }).select('_id').lean()
    if (!community) return res.status(404).json({ success: false, message: 'Community not found.' })
    if (kind === 'taluk') {
      const district = await District.findById(districtId).lean()
      if (!district) return res.status(400).json({ success: false, message: 'District not found.' })
      // Load overrides before filtering/paging so inactive entries remain hidden
      // and duplicate names do not change totals between pages.
      const choices = await LocationChoice.find({ communityId: community._id, kind, districtId }).lean()
      const search = String(req.query.search || '').normalize('NFKC').trim().slice(0, 80).toLowerCase()
      const matches = mergeTaluks(district, choices).filter(item => item.nameEnglish.toLowerCase().includes(search))
      const page = Math.max(1, parseInt(req.query.page, 10) || 1)
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 100))
      return res.json({ success: true, data: { items: matches.slice((page - 1) * limit, page * limit), pagination: { page, limit, total: matches.length, pages: Math.ceil(matches.length / limit) } } })
    }
    const query = { communityId: community._id, status: 'ACTIVE', kind, districtId }
    for (const key of ['blockId', 'villagePanchayatId', 'habitationId']) if (req.query[key]) {
      if (!mongoose.isValidObjectId(req.query[key])) return res.status(400).json({ success: false, message: 'Choose a valid parent location.' })
      query.$and ||= []
      query.$and.push({ $or: [{ [key]: req.query[key] }, { [key]: { $exists: false } }] })
    }
    if (req.query.search) query.nameEnglish = new RegExp(String(req.query.search).slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 100))
    const [items, total] = await Promise.all([LocationChoice.find(query).sort({ nameEnglish: 1 }).skip((page - 1) * limit).limit(limit).lean(), LocationChoice.countDocuments(query)])
    res.json({ success: true, data: { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } } })
  } catch (error) { next(error) }
}
exports.manage = async (req, res, next) => {
  try { res.json({ success: true, data: await LocationChoice.find({ communityId: req.communityId }).sort({ kind: 1, nameEnglish: 1 }).lean() }) }
  catch (error) { next(error) }
}
exports.create = async (req, res, next) => {
  try {
    const { kind, nameEnglish, districtId, blockId, villagePanchayatId, habitationId } = req.body || {}
    if (!kinds.includes(kind) || typeof nameEnglish !== 'string' || !/^[\x20-\x7e]{1,160}$/.test(nameEnglish.trim()) || !mongoose.isValidObjectId(districtId)) return res.status(400).json({ success: false, message: 'Provide an English location name, type and district.' })
    if (!(await District.exists({ _id: districtId }))) return res.status(400).json({ success: false, message: 'District not found.' })
    const payload = { communityId: req.communityId, kind, nameEnglish: nameEnglish.trim(), districtId }
    for (const [key, value, model, parent, parentValue] of [['blockId', blockId, Block, 'districtId', districtId], ['villagePanchayatId', villagePanchayatId, VillagePanchayat, 'blockId', blockId], ['habitationId', habitationId, Habitation, 'villagePanchayatId', villagePanchayatId]]) {
      if (!value) continue
      if (!parentValue || !mongoose.isValidObjectId(value) || !(await model.exists({ _id: value, [parent]: parentValue }))) return res.status(400).json({ success: false, message: 'The location does not belong to the selected parent.' })
      payload[key] = value
    }
    res.status(201).json({ success: true, data: await LocationChoice.create(payload) })
  } catch (error) { next(error) }
}
exports.update = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.choiceId) || !['ACTIVE', 'INACTIVE'].includes(req.body.status)) return res.status(400).json({ success: false, message: 'Choose an active or inactive status.' })
    const record = await LocationChoice.findOneAndUpdate({ _id: req.params.choiceId, communityId: req.communityId }, { $set: { status: req.body.status } }, { returnDocument: 'after', runValidators: true })
    if (!record) return res.status(404).json({ success: false, message: 'Location not found.' })
    res.json({ success: true, data: record })
  } catch (error) { next(error) }
}

