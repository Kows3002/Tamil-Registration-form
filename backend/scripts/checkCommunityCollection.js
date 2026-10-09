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
const reports = require('../src/controllers/reportController')
const { publicReceipt } = require('../src/controllers/familyController')
const { hashReceiptToken } = require('../src/utils/receipt')
const { PassThrough } = require('node:stream')

async function captureDownload(handler, request) {
  const response = new PassThrough(), chunks = []
  response.setHeader = () => {}
  const ended = new Promise((resolve, reject) => { response.on('data', chunk => chunks.push(chunk)); response.on('end', resolve); response.on('error', reject) })
  await handler(request, response, error => { throw error })
  await ended
  return Buffer.concat(chunks)
}

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
  const originalAggregate = Family.aggregate, originalFind = Family.find, originalFindOne = Family.findOne
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
    assert.match(result.data.receiptToken, /^[a-f0-9]{64}$/)
    assert.equal(result.data.receiptTokenHash, undefined)
    const secret = await Family.findById(saved._id).select('+receiptTokenHash +receiptExpiresAt').session(session).lean()
    assert.equal(secret.receiptTokenHash, hashReceiptToken(result.data.receiptToken))
    Family.aggregate = function (pipeline) { return originalAggregate.call(this, pipeline).session(session) }
    Family.find = function (...args) { return originalFind.apply(this, args).session(session) }
    Family.findOne = function (...args) { return originalFindOne.apply(this, args).session(session) }
    const reportRequest = { admin: { role: 'SUPER_ADMIN' }, query: { communityId: String(community._id), search: body.familyHeadName } }
    let report
    await reports.list(reportRequest, { json(value) { report = value } }, error => { throw error })
    assert.equal(report.data.totals.families, 1)
    assert.equal(report.data.totals.members, 1)
    assert.equal(report.data.summary[0].district, district.nameEnglish)
    assert.equal(report.data.summary[0].community, community.name)
    assert.equal(report.data.records[0].receiptTokenHash, undefined)
    for (const kind of ['summary', 'families', 'members']) {
      const csv = await captureDownload(reports.exportCsv, { ...reportRequest, query: { ...reportRequest.query, kind } })
      assert.ok(csv.toString().includes(community.name))
      assert.ok(csv.toString().includes(district.nameEnglish))
      if (kind !== 'summary') assert.ok(csv.toString().includes(body.familyHeadName))
    }
    const pdf = await captureDownload(publicReceipt, { params: { id: String(saved._id) }, get: () => result.data.receiptToken })
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-')
    console.log('PASS: real report aggregation, three CSV formats and token-protected PDF download inside the uncommitted transaction.')
    await session.abortTransaction()
    assert.equal(await Family.findById(saved._id), null)
    assert.throws(() => collection.members([{ name: 'QA', age: 121 }], community._id), /age/)
    assert.throws(() => collection.engagement('support', { needed: true, categories: ['Invalid'], details: 'QA' }), /categories/)
    assert.throws(() => collection.engagement('contribution', { willing: true, categories: [] }), /category/)
    await assert.rejects(collection.resolveLocation({ districtId: String(new mongoose.Types.ObjectId()), blockId: String(block._id) }, true), /selected/)
    console.log('PASS: MongoDB transaction round trip preserves family, member, location, support, contribution, tenant, form version and consent data; invalid input rejected; transaction aborted and no test record committed.')
  } finally {
    Family.create = originalCreate
    Family.aggregate = originalAggregate; Family.find = originalFind; Family.findOne = originalFindOne
    if (session.inTransaction()) await session.abortTransaction()
    await session.endSession()
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1 }).finally(() => mongoose.disconnect())
