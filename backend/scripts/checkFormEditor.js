// Verify the editor's real persistence workflow, then roll back all test data.
require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env'), quiet: true })
const assert = require('node:assert/strict')
const mongoose = require('mongoose')
const Community = require('../src/models/Community')
const FormConfiguration = require('../src/models/FormConfiguration')
const Family = require('../src/models/Family')
const { District } = require('../src/models/MasterData')
const forms = require('../src/controllers/communityController')
const { createFamily } = require('../src/controllers/familyController')
async function call(handler, request) {
  let status = 200, body
  const response = { status(value) { status = value; return this }, json(value) { body = value } }
  await handler(request, response, error => { throw error })
  return { status, body }
}
;(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 })
  const district = await District.findOne({ stateCode: 'TN' }).lean()
  assert(district, 'Import location masters before this check.')
  const session = await mongoose.startSession(), originals = []
  const withSession = (model, method) => {
    const original = model[method]; originals.push(() => { model[method] = original })
    model[method] = function (...args) { return original.apply(this, args).session(session) }
  }
  try {
    session.startTransaction()
    const community = new Community({ name: 'Synthetic editor check', code: `QA-${Date.now()}`, slug: `synthetic-editor-${Date.now()}`, settings: { allowPublicRegistration: true } })
    await community.save({ session })
    withSession(FormConfiguration, 'findOneAndUpdate'); withSession(FormConfiguration, 'findOne'); withSession(Community, 'findOne')
    const originalCreate = Family.create; originals.push(() => { Family.create = originalCreate })
    Family.create = async payload => new Family(payload).save({ session })
    const request = { communityId: community._id }
    const opened = await call(forms.getForm, request)
    const config = opened.body.data.toObject(), sections = config.versions[0].sections
    assert.equal(sections.length, 5)
    sections[0].title = 'Edited family information'
    sections[0].fields.find(field => field.key === 'email').required = true
    sections[0].fields.push({ key: 'custom_language', label: 'Preferred language', type: 'select', options: ['Tamil', 'English'], required: true, visible: true, order: 20 })
    sections[0].fields.push({ key: 'custom_followup', label: 'Please contact me', type: 'checkbox', required: false, visible: true, order: 21 })
    const saved = await call(forms.saveDraft, { ...request, body: { sections } })
    assert.equal(saved.status, 200)
    assert.equal(saved.body.data.activeVersion, 1)
    const draft = saved.body.data.versions.at(-1)
    assert.equal(draft.templateKey, 'family-directory-v4')
    await call(forms.publishForm, { ...request, params: { versionId: String(draft._id) } })
    const publicForm = await call(forms.publicBySlug, { params: { slug: community.slug } })
    assert.equal(publicForm.body.data.form.sections[0].title, sections[0].title)
    assert.equal(publicForm.body.data.form.version, 2)
    const body = { communitySlug: community.slug, familyHeadName: 'Synthetic editor family', phoneNumber: '9876543210', email: 'qa@example.invalid', address: 'Synthetic test address', stateCode: 'TN', settlementType: 'Urban', districtId: String(district._id), district: district.nameEnglish, villageManual: true, villageName: 'Synthetic town', postalCode: '638001', members: [{ name: 'Synthetic member', age: 0, occupation: 'Student' }], consent: true, custom_followup: false }
    const missing = await call(createFamily, { body })
    assert.equal(missing.status, 400)
    assert.match(missing.body.message, /Preferred language/)
    const submission = await call(createFamily, { body: { ...body, custom_language: 'Tamil' } })
    assert.equal(submission.status, 201, submission.body?.message)
    assert.equal(submission.body.data.customData.custom_language, 'Tamil')
    assert.equal(submission.body.data.customData.custom_followup, false)
    assert.equal(submission.body.data.formVersion, 2)
    await session.abortTransaction()
    assert.equal(await Community.findById(community._id), null)
    assert.equal(await Family.findById(submission.body.data._id), null)
    console.log('PASS: MongoDB template initialization, edit, required checkbox settings, extra questions, draft, publish, public form and submission validation. Transaction rolled back; no test records or public changes committed.')
  } finally {
    originals.reverse().forEach(restore => restore())
    if (session.inTransaction()) await session.abortTransaction()
    await session.endSession()
  }
})().catch(error => { console.error(error.message); process.exitCode = 1 }).finally(() => mongoose.disconnect())
