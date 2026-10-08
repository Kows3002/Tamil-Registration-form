const mongoose = require('mongoose')
const { District, Block, VillagePanchayat, Habitation, AssemblyConstituency, PostOffice, Pincode } = require('../models/MasterData')
const { englishText } = require('../utils/english')

const positiveInt = (value, fallback, maximum) => {
  const number = Number.parseInt(value, 10)
  return Number.isFinite(number) && number > 0 ? Math.min(number, maximum) : fallback
}
const safePattern = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const paged = (model, queryFor, sort) => async (req, res, next) => {
  try {
    const page = positiveInt(req.query.page, 1, 1000000)
    const limit = positiveInt(req.query.limit, 50, 100)
    const query = queryFor(req, res)
    if (query === null) return
    const [items, total] = await Promise.all([
      model.find(query).sort(sort || { nameTamil: 1, name: 1, code: 1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
      model.countDocuments(query),
    ])
    const englishItems = items.map(item => { const { nameTamil, nameSearch, nameSearchTamil, ...rest } = item; return { ...rest, nameEnglish: item.nameEnglish || item.name || englishText(nameTamil || item.code), displayName: item.nameEnglish || item.name || englishText(nameTamil || item.code) } })
    res.json({ success: true, data: { items: englishItems, pagination: { page, limit, total, pages: Math.ceil(total / limit) } } })
  } catch (error) { next(error) }
}
const parentId = (req, res, key) => {
  const value = String(req.query[key] || '')
  if (!mongoose.isValidObjectId(value)) {
    res.status(400).json({ success: false, message: 'Choose a valid parent location.' })
    return null
  }
  return new mongoose.Types.ObjectId(value)
}
const nameSearch = (req, fields) => {
  const search = String(req.query.search || '').normalize('NFKC').trim().slice(0, 80).toLocaleLowerCase('en')
  if (!search.length) return {}
  const pattern = new RegExp(safePattern(search), 'i')
  return { $or: fields.map(field => ({ [field]: pattern })) }
}
const combine = (parent, search) => parent ? { $and: [parent, search] } : search

module.exports = {
  districts: paged(District, req => combine(req.query.stateCode ? req.query.stateCode === 'TN' ? { $or: [{ stateCode: 'TN' }, { stateCode: { $exists: false } }] } : { stateCode: String(req.query.stateCode) } : null, nameSearch(req, ['nameSearchEnglish', 'nameEnglish', 'nameTamil'])), { nameEnglish: 1, code: 1, _id: 1 }),
  blocks: paged(Block, (req, res) => { const id = parentId(req, res, 'districtId'); return id ? combine({ districtId: id }, nameSearch(req, ['nameSearchEnglish', 'nameEnglish', 'nameTamil'])) : null }, { nameEnglish: 1, code: 1, _id: 1 }),
  villages: paged(VillagePanchayat, (req, res) => { const id = parentId(req, res, 'blockId'); return id ? combine({ blockId: id }, nameSearch(req, ['nameSearchEnglish', 'nameEnglish', 'nameTamil'])) : null }, { nameEnglish: 1, code: 1, _id: 1 }),
  habitations: paged(Habitation, (req, res) => { const id = parentId(req, res, 'villagePanchayatId'); return id ? combine({ villagePanchayatId: id }, nameSearch(req, ['nameSearchEnglish', 'nameEnglish', 'nameTamil'])) : null }, { nameEnglish: 1, code: 1, _id: 1 }),
  assemblies: paged(AssemblyConstituency, req => nameSearch(req, ['nameSearch']), { sourceOrder: 1, _id: 1 }),
  postOffices: paged(PostOffice, (req, res) => { const id = req.query.pincodeId ? parentId(req, res, 'pincodeId') : undefined; return req.query.pincodeId && !id ? null : combine(id ? { pincodeId: id } : null, nameSearch(req, ['nameSearch', 'nameEnglish', 'name', 'pincode'])) }, { nameSearch: 1, _id: 1 }),
  pincodes: paged(Pincode, req => nameSearch(req, ['code']), { code: 1 }),
}

