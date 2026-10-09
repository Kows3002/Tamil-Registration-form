const mongoose = require('mongoose')
const Family = require('../models/Family')
const Community = require('../models/Community')

function fail(message, status = 400) { const error = new Error(message); error.status = status; throw error }
function scopeFor(admin) {
  return admin.role === 'SUPER_ADMIN' ? { status: { $ne: 'ARCHIVED' } } : { status: { $ne: 'ARCHIVED' }, communityId: { $in: (admin.communityIds || []).map(id => new mongoose.Types.ObjectId(String(id))) } }
}
function filterFor(admin, query) {
  const filter = scopeFor(admin)
  if (query.communityId) {
    if (!mongoose.isValidObjectId(query.communityId)) fail('Choose a valid community.')
    if (admin.role !== 'SUPER_ADMIN' && !(admin.communityIds || []).some(id => String(id) === query.communityId)) fail('You do not have access to this community.', 403)
    filter.communityId = new mongoose.Types.ObjectId(query.communityId)
  }
  if (query.district) filter.district = String(query.district).trim().slice(0, 120)
  if (query.status) { if (!['ACTIVE', 'PENDING', 'VERIFIED', 'REJECTED'].includes(query.status)) fail('Choose a valid registration status.'); filter.status = query.status }
  for (const [key, operator, time] of [['from', '$gte', '00:00:00.000'], ['to', '$lte', '23:59:59.999']]) {
    if (!query[key]) continue
    if (!/^\d{4}-\d{2}-\d{2}$/.test(query[key])) fail('Choose a valid report date.')
    const date = new Date(`${query[key]}T${time}+05:30`)
    if (Number.isNaN(date.getTime()) || date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) !== query[key]) fail('Choose a valid report date.')
    filter.createdAt ||= {}; filter.createdAt[operator] = date
  }
  if (filter.createdAt?.$gte > filter.createdAt?.$lte) fail('The start date must be before the end date.')
  if (query.search) {
    const pattern = new RegExp(String(query.search).trim().slice(0, 120).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    filter.$or = ['familyHeadName', 'phoneNumber', 'villageName', 'members.name', 'members.nameAddress'].map(key => ({ [key]: pattern }))
  }
  return filter
}
const summaryStages = [
  { $group: { _id: { district: '$district', communityId: '$communityId' }, families: { $sum: 1 }, members: { $sum: { $size: { $ifNull: ['$members', []] } } } } },
  { $lookup: { from: Community.collection.name, localField: '_id.communityId', foreignField: '_id', as: 'community' } },
  { $project: { _id: 0, district: '$_id.district', communityId: '$_id.communityId', community: { $ifNull: [{ $arrayElemAt: ['$community.name', 0] }, 'Unknown community'] }, families: 1, members: 1 } },
  { $sort: { district: 1, community: 1 } },
]

exports.list = async (req, res, next) => {
  try {
    const filter = filterFor(req.admin, req.query)
    const page = Math.max(1, Math.min(100000, parseInt(req.query.page, 10) || 1)), limit = 30
    const [result, districts, communities] = await Promise.all([
      Family.aggregate([{ $match: filter }, { $facet: {
        summary: summaryStages,
        total: [{ $count: 'count' }],
        records: [{ $sort: { createdAt: -1, _id: -1 } }, { $skip: (page - 1) * limit }, { $limit: limit }, { $lookup: { from: Community.collection.name, localField: 'communityId', foreignField: '_id', as: 'community' } }, { $project: { _id: 1, familyHeadName: 1, phoneNumber: 1, district: 1, villageName: 1, communityId: 1, community: { $arrayElemAt: ['$community.name', 0] }, status: 1, createdAt: 1, memberCount: { $size: { $ifNull: ['$members', []] } } } }],
      } }]),
      Family.distinct('district', scopeFor(req.admin)),
      Community.find(req.admin.role === 'SUPER_ADMIN' ? {} : { _id: { $in: req.admin.communityIds || [] } }).select('name slug').sort({ name: 1 }).lean(),
    ])
    const data = result[0] || { summary: [], records: [], total: [] }
    const total = data.total[0]?.count || 0
    res.json({ success: true, data: { summary: data.summary, records: data.records, totals: { families: total, members: data.summary.reduce((sum, row) => sum + row.members, 0), districts: new Set(data.summary.map(row => row.district)).size, communities: new Set(data.summary.map(row => String(row.communityId))).size }, districts: districts.filter(Boolean).sort(), communities, pagination: { page, limit, total, pages: Math.ceil(total / limit) } } })
  } catch (error) { if (error.status) return res.status(error.status).json({ success: false, message: error.message }); next(error) }
}

function csvCell(value) {
  const text = value === undefined || value === null ? '' : Array.isArray(value) ? value.join('; ') : String(value)
  // Prevent downloaded user-entered fields becoming spreadsheet formulas.
  return `"${(/^[\s]*[=+\-@]/.test(text) ? `'${text}` : text).replaceAll('"', '""')}"`
}
const line = values => values.map(csvCell).join(',') + '\r\n'
exports.exportCsv = async (req, res, next) => {
  try {
    const filter = filterFor(req.admin, req.query), kind = req.query.kind || 'summary'
    if (!['summary', 'families', 'members'].includes(kind)) fail('Choose summary, families or members export.')
    const communities = await Community.find(req.admin.role === 'SUPER_ADMIN' ? {} : { _id: { $in: req.admin.communityIds || [] } }).select('name').lean()
    const names = new Map(communities.map(item => [String(item._id), item.name]))
    let summary
    if (kind === 'summary') summary = await Family.aggregate([{ $match: filter }, ...summaryStages])
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="sangam-${kind}.csv"`)
    res.setHeader('Cache-Control', 'no-store')
    res.write('\uFEFF')
    if (summary) {
      res.write(line(['District', 'Community', 'Families registered', 'Family members']))
      for (const row of summary) res.write(line([row.district, row.community, row.families, row.members]))
    } else {
      const familyFields = ['_id', 'familyHeadName', 'phoneNumber', 'alternatePhone', 'email', 'familyType', 'preferredContact', 'address', 'state', 'district', 'settlementType', 'taluk', 'block', 'villagePanchayat', 'villageName', 'habitation', 'wardNumber', 'streetArea', 'postalCode', 'postOffice', 'housingType', 'familyAnnualIncome', 'governmentSchemes', 'householdNotes', 'status', 'createdAt']
      const memberFields = ['name', 'relationship', 'age', 'gender', 'maritalStatus', 'education', 'occupation', 'workLocation', 'phoneNumber', 'skills']
      const headers = kind === 'families' ? ['Community', ...familyFields, 'memberCount', 'helpNeeded', 'helpCategories', 'helpDetails', 'helpPriority', 'contributionWilling', 'contributionCategories', 'contributionDetails', 'contributionSkills', 'contributionAvailability', 'consent', 'customData'] : ['Community', 'Family reference', 'Family head', 'District', 'Village / town', ...memberFields]
      res.write(line(headers))
      const cursor = Family.find(filter).sort({ district: 1, communityId: 1, createdAt: -1 }).lean().cursor()
      try {
        for await (const family of cursor) {
          if (res.destroyed) break
          const community = names.get(String(family.communityId)) || 'Unknown community'
          if (kind === 'members') for (const member of family.members || []) res.write(line([community, family._id, family.familyHeadName, family.district, family.villageName, ...memberFields.map(key => key === 'name' ? member.name || member.nameAddress : member[key])]))
          else res.write(line([community, ...familyFields.map(key => family[key]), family.members?.length || 0, family.support?.needed || false, family.support?.categories, family.support?.details, family.support?.priority, family.contribution?.willing || false, family.contribution?.categories, family.contribution?.details, family.contribution?.skills, family.contribution?.availability, family.consent, family.customData ? JSON.stringify(family.customData) : '']))
        }
      } finally { await cursor.close() }
    }
    res.end()
  } catch (error) { if (res.headersSent) return res.destroy(error); if (error.status) return res.status(error.status).json({ success: false, message: error.message }); next(error) }
}
exports.filterFor = filterFor
exports.csvCell = csvCell
