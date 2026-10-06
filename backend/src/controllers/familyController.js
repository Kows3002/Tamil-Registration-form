const mongoose = require('mongoose')
const Family = require('../models/Family')

const cleanPhone = value => !value || /^[+\d\s()-]{7,16}$/.test(value)
exports.createFamily = async (req, res, next) => {
  try {
    const payload = { ...req.body }
    for (const key of ['districtId', 'blockId', 'villagePanchayatId', 'habitationId', 'assemblyConstituencyId', 'postOfficeId', 'pincodeId']) if (!payload[key]) delete payload[key]
    if (!cleanPhone(payload.phoneNumber) || (payload.members || []).some(m => !cleanPhone(m.phoneNumber) || !cleanPhone(m.additionalPhone))) return res.status(400).json({ success: false, message: 'சரியான தொலைபேசி எண்ணை உள்ளிடவும்.' })
    if (!Array.isArray(payload.members) || !payload.members.some(m => String(m.nameAddress || m.name || '').trim())) return res.status(400).json({ success: false, message: 'குறைந்தது ஒரு குடும்ப உறுப்பினர் தேவை.' })
    payload.members = payload.members.filter(m => String(m.nameAddress || m.name || '').trim()).map((m, i) => ({ ...m, nameAddress: m.nameAddress || m.name, age: m.age === '' ? undefined : m.age, serialNumber: i + 1 }))
    const family = await Family.create(payload)
    res.status(201).json({ success: true, data: family })
  } catch (error) { next(error) }
}
exports.listFamilies = async (req, res, next) => { try { const families = await Family.find().sort({ createdAt: -1 }).lean(); res.json({ success: true, data: families }) } catch (e) { next(e) } }
exports.getFamily = async (req, res, next) => { try { if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'தவறான பதிவு எண்.' }); const family = await Family.findById(req.params.id); if (!family) return res.status(404).json({ success: false, message: 'பதிவு கிடைக்கவில்லை.' }); res.json({ success: true, data: family }) } catch (e) { next(e) } }
exports.updateFamily = async (req, res, next) => { try { if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'தவறான பதிவு எண்.' }); const payload = { ...req.body }; for (const key of ['districtId', 'blockId', 'villagePanchayatId', 'habitationId', 'assemblyConstituencyId', 'postOfficeId', 'pincodeId']) if (!payload[key]) delete payload[key]; delete payload._id; delete payload.createdAt; delete payload.updatedAt; if (!Array.isArray(payload.members) || !payload.members.some(m => String(m.nameAddress || m.name || '').trim())) return res.status(400).json({ success: false, message: 'குறைந்தது ஒரு குடும்ப உறுப்பினர் தேவை.' }); payload.members = payload.members.filter(m => String(m.nameAddress || m.name || '').trim()).map((m, i) => ({ ...m, nameAddress: m.nameAddress || m.name, age: m.age === '' ? undefined : m.age, serialNumber: i + 1 })); const family = await Family.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true }); if (!family) return res.status(404).json({ success: false, message: 'பதிவு கிடைக்கவில்லை.' }); res.json({ success: true, data: family }) } catch (e) { next(e) } }
exports.deleteFamily = async (req, res, next) => { try { if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'தவறான பதிவு எண்.' }); const family = await Family.findByIdAndDelete(req.params.id); if (!family) return res.status(404).json({ success: false, message: 'பதிவு கிடைக்கவில்லை.' }); res.json({ success: true, data: { id: family._id } }) } catch (e) { next(e) } }
