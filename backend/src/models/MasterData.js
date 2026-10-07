const mongoose = require('mongoose')

const options = { timestamps: true, strict: true }
const englishName = { nameEnglish: { type: String, trim: true }, nameSearchEnglish: { type: String, index: true }, englishSource: String }
const districtSchema = new mongoose.Schema({ code: { type: String, required: true, unique: true }, nameTamil: { type: String, required: true, trim: true }, nameEnglish: { type: String, trim: true }, nameSearchTamil: { type: String, required: true, index: true }, nameSearchEnglish: { type: String, required: true, index: true }, sourceKey: { type: String, required: true, unique: true } }, options)
const blockSchema = new mongoose.Schema({ code: { type: String, required: true, unique: true }, districtId: { type: mongoose.Schema.Types.ObjectId, ref: 'District', required: true }, districtCode: { type: String, required: true, index: true }, nameTamil: { type: String, required: true, trim: true }, nameSearch: { type: String, required: true, index: true }, sourceKey: { type: String, required: true, unique: true } }, options)
blockSchema.index({ districtId: 1, code: 1 })
districtSchema.add({ stateCode: { type: String, default: 'TN', index: true } })
blockSchema.add(englishName)
const villageSchema = new mongoose.Schema({ code: { type: String, required: true, unique: true }, districtId: { type: mongoose.Schema.Types.ObjectId, ref: 'District', required: true, index: true }, districtCode: { type: String, required: true, index: true }, blockId: { type: mongoose.Schema.Types.ObjectId, ref: 'Block', required: true }, blockCode: { type: String, required: true, index: true }, nameTamil: { type: String, required: true, trim: true }, nameSearch: { type: String, required: true, index: true }, sourceKey: { type: String, required: true, unique: true } }, options)
villageSchema.index({ blockId: 1, code: 1 })
villageSchema.add(englishName)
const habitationSchema = new mongoose.Schema({ sourceKey: { type: String, required: true, unique: true }, code: { type: String, required: true }, districtCode: { type: String, required: true, index: true }, blockCode: { type: String, required: true, index: true }, villagePanchayatCode: { type: String, required: true }, villagePanchayatId: { type: mongoose.Schema.Types.ObjectId, ref: 'VillagePanchayat', required: true }, nameTamil: { type: String, required: true, trim: true }, nameSearch: { type: String, required: true, index: true }, sourceDistrictCode: String, sourceBlockCode: String }, options)
habitationSchema.index({ villagePanchayatId: 1, code: 1 }, { unique: true })
habitationSchema.add(englishName)
const assemblySchema = new mongoose.Schema({ sourceKey: { type: String, required: true, unique: true }, name: { type: String, required: true, trim: true }, nameSearch: { type: String, required: true, index: true }, nameTamil: { type: String, default: null }, sourceOrder: Number, sourcePage: Number, officialNumber: { type: String, default: null }, officialCode: { type: String, default: null } }, options)
const pincodeSchema = new mongoose.Schema({ code: { type: String, required: true, unique: true } }, options)
const postOfficeSchema = new mongoose.Schema({ sourceKey: { type: String, required: true, unique: true }, name: { type: String, required: true, trim: true }, nameSearch: { type: String, required: true, index: true }, pincodeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pincode', required: true, index: true }, pincode: { type: String, required: true, index: true }, deliveryStatus: String, officeType: String, circle: String, region: String, division: String }, options)

module.exports = {
  District: mongoose.models.District || mongoose.model('District', districtSchema, 'districts'),
  Block: mongoose.models.Block || mongoose.model('Block', blockSchema, 'blocks'),
  VillagePanchayat: mongoose.models.VillagePanchayat || mongoose.model('VillagePanchayat', villageSchema, 'villagePanchayats'),
  Habitation: mongoose.models.Habitation || mongoose.model('Habitation', habitationSchema, 'habitations'),
  AssemblyConstituency: mongoose.models.AssemblyConstituency || mongoose.model('AssemblyConstituency', assemblySchema, 'assemblyConstituencies'),
  PostOffice: mongoose.models.PostOffice || mongoose.model('PostOffice', postOfficeSchema, 'postOffices'),
  Pincode: mongoose.models.Pincode || mongoose.model('Pincode', pincodeSchema, 'pincodes'),
}
