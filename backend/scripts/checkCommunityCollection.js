// Integration check: writes and reads inside a transaction, then aborts it.
// No test family is committed to the application database.
require('dotenv').config({ path: require('node:path').join(__dirname, '../.env') })
const assert = require('node:assert/strict')
const mongoose = require('mongoose')
const Family = require('../src/models/Family')
const Community = require('../src/models/Community')
const FormConfiguration = require('../src/models/FormConfiguration')
const { District, Block, VillagePanchayat, Habitation, Pincode, PostOffice } = require('../src/models/MasterData')
const { createFamily } = require('../src/controllers/familyController')
const collection = require('../src/controllers/familyCollection')

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 })
  const community = await Community.findOne({ slug: 'krishnan-community' }).lean()
  assert(community, 'Start the backend once to create the default community.')
  const form = await FormConfiguration.findOne({ communityId: community._id }).lean()
  const active = form.versions.find(version => version.version === form.activeVersion)
  assert(active.sections.some(section => section.fields.some(field => field.type === 'support')))
  const district = await District.findOne({ nameEnglish: /salem/i }).lean()
  const block = await Block.findOne({ districtId: district._id }).lean()
  const village = await VillagePanchayat.findOne({ blockId: block._id }).lean()
  const habitation = await Habitation.findOne({ villagePanchayatId: village._id }).lean()
  const postOffice = await PostOffice.findOne().lean()
  const pincode = await Pincode.findById(postOffice.pincodeId).lean()
  assert(district && block && village && habitation && postOffice && pincode, 'Import location masters before running the integration check.')
  const body = {
    stateCode: 'TN', settlementType: 'Rural', villageSameAsPanchayat: true, wardNumber: '17', locationMissing: ['taluk', 'street'],
    communitySlug: community.slug, communityId: String(community._id), familyHeadName: 'Community collection transaction check', phoneNumber: '9876543210',
    email: 'qa@example.invalid', familyType: 'Joint family', address: 'Synthetic test address', preferredContact: 'Phone call',
    district: district.nameEnglish, villageName: village.nameTamil, districtId: String(district._id), blockId: String(block._id),
    villagePanchayatId: String(village._id), habitationId: String(habitation._id), postOfficeId: String(postOffice._id), pincodeId: String(pincode._id),
    housingType: 'Own home', mainOccupation: 'Salaried employment', familyAnnualIncome: '₹1–3 lakh',
    members: [{ name: 'Synthetic member', relationship: 'Self', age: 32, gender: 'Female', education: 'Graduate', occupation: 'Teacher', skills: 'Mentoring' }],
    support: { needed: true, categories: ['Education'], details: 'Synthetic education request', priority: 'Soon' },
    contribution: { willing: true, categories: ['Volunteer time'], details: 'Synthetic tutoring offer', skills: 'Teaching', availability: 'Weekends' }, consent: true,
  }
  const session = await mongoose.startSession()
  const originalCreate = Family.create
  let result
  try {
    session.startTransaction()
    Family.create = async payload => { const doc = new Family(payload); return doc.save({ session }) }
    const response = { code: 200, status(code) { this.code = code; return this }, json(value) { result = value; return this } }
    let caught
    await createFamily({ body }, response, error => { caught = error })
    if (caught) throw caught
    assert.equal(response.code, 201, result?.message)
    const saved = await Family.findById(result.data._id).session(session).lean()
    assert.equal(saved.members[0].education, 'Graduate')
    assert.equal(saved.members[0].occupation, 'Teacher')
    assert.equal(saved.members[0].relationship, 'Self')
    assert.equal(String(saved.members[0].communityId), String(community._id))
    assert.equal(String(saved.communityId), String(community._id))
    assert.equal(saved.formVersion, form.activeVersion)
    assert.equal(String(saved.habitationId), String(habitation._id))
    assert.equal(saved.postalCode, pincode.code)
    assert.equal(saved.support.details, body.support.details)
    assert.equal(saved.contribution.availability, 'Weekends')
    assert.equal(saved.stateCode, 'TN')
    assert.equal(saved.settlementType, 'Rural')
    assert.equal(saved.villageName, village.nameEnglish)
    assert.equal(saved.villagePanchayat, village.nameEnglish)
    assert.equal(saved.wardNumber, '17')
    assert.deepEqual(saved.locationMissing, ['taluk', 'street'])
    assert.equal(saved.status, 'PENDING')
    assert(saved.consent && saved.consentAt)
    await session.abortTransaction()
    assert.equal(await Family.findById(saved._id), null)
    assert.throws(() => collection.members([{ name: 'QA', age: 121 }], community._id), /age/)
    assert.throws(() => collection.engagement('support', { needed: true, categories: ['Invalid'], details: 'QA' }), /categories/)
    assert.throws(() => collection.engagement('contribution', { willing: true, categories: [] }), /category/)
    await assert.rejects(collection.resolveLocation({ districtId: String(new mongoose.Types.ObjectId()), blockId: String(block._id) }, true), /selected/)
    console.log('PASS: MongoDB transaction round trip preserves family, member, location, support, contribution, tenant, form version and consent data; invalid input rejected; transaction aborted and no test record committed.')
  } finally {
    Family.create = originalCreate
    if (session.inTransaction()) await session.abortTransaction()
    await session.endSession()
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1 }).finally(() => mongoose.disconnect())
