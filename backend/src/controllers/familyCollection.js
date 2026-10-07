const mongoose = require('mongoose')
const { District, Block, VillagePanchayat, Habitation, AssemblyConstituency, PostOffice, Pincode } = require('../models/MasterData')
const Family = require('../models/Family')
const LocationChoice = require('../models/LocationChoice')
const { englishText } = require('../utils/english')
const SUPPORT = ['Education', 'Healthcare', 'Employment', 'Food & essentials', 'Housing', 'Elder care', 'Disability support', 'Other']
const CONTRIBUTIONS = ['Volunteer time', 'Teaching & mentoring', 'Professional skills', 'Job opportunities', 'Food & supplies', 'Financial support', 'Other']
function invalid(message) { const error = new Error(message); error.status = 400; throw error }
function text(value, max, label) {
  if (value === undefined || value === null || value === '') return ''
  if (typeof value !== 'string' || value.trim().length > max) invalid(`Enter a valid ${label}.`)
  return value.trim()
}
function categories(value, allowed) {
  if (!Array.isArray(value) || value.some(item => !allowed.includes(item))) invalid('Choose valid community support or contribution categories.')
  return [...new Set(value)]
}
function engagement(kind, value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(`Enter valid ${kind} details.`)
  const flag = kind === 'support' ? 'needed' : 'willing'
  if (value[flag] !== undefined && typeof value[flag] !== 'boolean') invalid(`Choose whether ${kind} is needed.`)
  if (!value[flag]) return { [flag]: false, categories: [] }
  const result = { [flag]: true, categories: categories(value.categories, kind === 'support' ? SUPPORT : CONTRIBUTIONS), details: text(value.details, 2000, 'description') }
  if (!result.categories.length || !result.details) invalid(`Choose a category and describe your ${kind === 'support' ? 'help request' : 'contribution'}.`)
  if (kind === 'support') {
    result.priority = value.priority || 'Routine'
    if (!['Routine', 'Soon', 'Urgent'].includes(result.priority)) invalid('Choose a valid request priority.')
  } else { result.skills = text(value.skills, 1000, 'skills'); result.availability = text(value.availability, 160, 'availability') }
  return result
}
function members(input, communityId) {
  if (!Array.isArray(input) || !input.length || input.length > 100) invalid('Add between 1 and 100 family members.')
  const schema = Family.schema.path('members').schema
  return input.map((member, index) => {
    if (!member || typeof member !== 'object' || Array.isArray(member)) invalid(`Enter valid details for member ${index + 1}.`)
    const result = {}
    for (const [key, path] of Object.entries(schema.paths)) {
      if (['_id', 'communityId', 'serialNumber', 'age'].includes(key) || member[key] === undefined) continue
      if (path.instance === 'String') result[key] = text(member[key], path.options.maxlength || 600, `member ${key}`)
      if (path.instance === 'Boolean') { if (typeof member[key] !== 'boolean') invalid(`Enter valid member ${key}.`); result[key] = member[key] }
    }
    result.nameAddress = result.nameAddress || result.name
    if (!result.nameAddress) invalid(`Enter the name of family member ${index + 1}.`)
    if (member.age !== undefined && member.age !== '') {
      const age = Number(member.age)
      if (!Number.isInteger(age) || age < 0 || age > 120) invalid(`Enter an age between 0 and 120 for member ${index + 1}.`)
      result.age = age
    }
    if (result.phoneNumber && !/^[+\d\s()-]{7,16}$/.test(result.phoneNumber)) invalid(`Enter a valid phone number for member ${index + 1}.`)
    return { ...result, communityId, serialNumber: index + 1 }
  })
}
async function resolveLocation(input, required = false, communityId) {
  const result = {}
  const specifications = [
    ['districtId', District, 'district', 'districtCode', null],
    ['blockId', Block, 'block', 'blockCode', 'districtId'],
    ['villagePanchayatId', VillagePanchayat, 'villagePanchayatNameTamil', 'villagePanchayatCode', 'blockId'],
    ['habitationId', Habitation, 'habitation', 'habitationCode', 'villagePanchayatId'],
    ['assemblyConstituencyId', AssemblyConstituency, 'assemblyConstituency', 'assemblyConstituencySourceKey', null],
    ['pincodeId', Pincode, 'postalCode', 'pincodeCode', null],
    ['postOfficeId', PostOffice, 'postOffice', 'postOfficeSourceKey', 'pincodeId'],
  ]
  for (const [key, model, label, code, parent] of specifications) {
    const id = input[key]
    if (!id) { if (required && (key === 'districtId' || (input.settlementType !== 'Urban' && specifications.slice(0, 4).some(item => item[0] === key)))) invalid('Select your district, block, village panchayat and habitation.'); continue }
    if (!mongoose.isValidObjectId(id)) invalid(`Choose a valid ${label}.`)
    const record = await model.findById(id).lean()
    if (!record || (parent && (!result[parent] || String(record[parent]) !== String(result[parent])))) invalid(`The selected ${label} does not belong to the selected parent location.`)
    result[key] = record._id
    result[label] = record.nameEnglish || record.name || englishText(record.nameTamil) || record.code
    result[code] = record.code || record.sourceKey
    if (key === 'districtId') result.districtNameTamil = record.nameTamil
    if (key === 'blockId') result.blockNameTamil = record.nameTamil
    if (key === 'habitationId') result.habitationNameTamil = record.nameTamil
    if (key === 'postOfficeId') { result.circle = record.circle; result.division = record.division }
  }
  if (input.stateCode || input.settlementType) {
    const state = require('../config/states').find(item => item.code === input.stateCode)
    if (!state || !['Rural', 'Urban'].includes(input.settlementType)) invalid('Select a valid state and rural or urban residence.')
    const district = await District.findById(result.districtId).lean()
    if (!district || (district.stateCode || 'TN') !== state.code) invalid('District does not belong to the selected state.')
    if (required && !result.pincodeId) invalid('Select your PIN code.')
    result.state = state.nameEnglish; result.stateCode = state.code; result.settlementType = input.settlementType
    result.villagePanchayat = result.villagePanchayatNameTamil
    if (input.villageSameAsPanchayat === true && result.villagePanchayat) { result.villageName = result.villagePanchayat; result.villageSameAsPanchayat = true }
    for (const [key, kind, label] of [['talukChoiceId', 'taluk', 'taluk'], ['villageChoiceId', 'village', 'villageName'], ['wardChoiceId', 'ward', 'wardNumber'], ['streetChoiceId', 'street', 'streetArea']]) {
      if (!input[key]) continue
      if (!mongoose.isValidObjectId(input[key])) invalid(`Choose a valid ${label}.`)
      const choice = await LocationChoice.findOne({ _id: input[key], communityId, kind, districtId: result.districtId, status: 'ACTIVE' }).lean()
      if (!choice) invalid(`The selected ${label} is not available for this community and district.`)
      for (const parent of ['blockId', 'villagePanchayatId', 'habitationId']) if (choice[parent] && String(choice[parent]) !== String(result[parent])) invalid(`The selected ${label} does not match your location.`)
      result[key] = choice._id; result[label] = choice.nameEnglish
    }
    if (input.wardNumber && !input.wardChoiceId) {
      if (!/^(?:[1-9]\d{0,2}|Not applicable|Not listed)$/.test(String(input.wardNumber))) invalid('Choose a valid ward number.')
      result.wardNumber = String(input.wardNumber)
    }
    if (required && !result.villageName) invalid('Select your village or town.')
    result.locationMissing = ['taluk', 'street'].filter(key => Array.isArray(input.locationMissing) && input.locationMissing.includes(key))
  }
  return result
}
module.exports = { engagement, members, resolveLocation, invalid }
