const { test } = require('node:test')
const assert = require('node:assert/strict')
const { validMobile } = require('../src/utils/phone')
const collection = require('../src/controllers/familyCollection')
const controller = require('../src/controllers/familyController')
const communities = require('../src/controllers/communityController')
const Community = require('../src/models/Community')
const FormConfiguration = require('../src/models/FormConfiguration')
const Family = require('../src/models/Family')
const { District, Pincode } = require('../src/models/MasterData')
const LocationChoice = require('../src/models/LocationChoice')
const sections = require('../src/config/communityForm')
const communityId = 'aaaaaaaaaaaaaaaaaaaaaaaa'
const districtId = 'bbbbbbbbbbbbbbbbbbbbbbbb'
const villageId = 'cccccccccccccccccccccccc'
const pincodeId = 'dddddddddddddddddddddddd'
const lean = value => ({ lean: async () => value })

test('mobile validation accepts local and country-prefixed numbers and rejects malformed numbers', () => {
  for (const value of ['9876543210', '6987654321', '+919876543210', '+91 9876543210', '91-9876543210', '', undefined]) assert.ok(validMobile(value), String(value))
  for (const value of ['1234567890', '987654321', '98765432101', 'abcdefghij', '+1 9876543210', '(987)6543210', 9876543210]) assert.equal(validMobile(value), false, String(value))
})

test('member work locations and integer ages are validated and preserved', () => {
  const member = { name: 'Sample', relationship: 'Sister', occupation: 'Government employee', workLocation: 'Government office, Chennai', age: '34', phoneNumber: '9876543210' }
  const result = collection.members([member], communityId, { requireWorkLocation: true })[0]
  assert.equal(result.workLocation, member.workLocation)
  assert.equal(result.relationship, 'Sister')
  assert.equal(result.age, 34)
  assert.throws(() => collection.members([{ ...member, workLocation: '' }], communityId, { requireWorkLocation: true }), /work location/)
  for (const age of ['-1', '121', '20.5', 'abc']) assert.throws(() => collection.members([{ ...member, age }], communityId), /age between/)
  assert.throws(() => collection.members([{ ...member, additionalPhone: '123' }], communityId), /mobile number/)
  assert.doesNotThrow(() => collection.members([{ name: 'Student', occupation: 'Student' }], communityId, { requireWorkLocation: true }))
})

test('marriage arrangement is accepted for both help and contribution', () => {
  assert.deepEqual(collection.engagement('support', { needed: true, categories: ['Marriage arrangement'], details: 'Seeking assistance' }).categories, ['Marriage arrangement'])
  assert.deepEqual(collection.engagement('contribution', { willing: true, categories: ['Marriage arrangement'], details: 'Can coordinate arrangements' }).categories, ['Marriage arrangement'])
})

function fixture(t) {
  const form = new FormConfiguration({ communityId, activeVersion: 1, versions: [{ version: 1, templateKey: 'family-directory-v4', status: 'PUBLISHED', sections }] }).toObject()
  t.mock.method(Community, 'findOne', () => lean({ _id: communityId }))
  t.mock.method(FormConfiguration, 'findOne', () => lean(form))
  t.mock.method(collection, 'resolveLocation', async () => ({ district: 'Chennai', villageName: 'Sample town', postalCode: '600001' }))
  t.mock.method(Family, 'create', async payload => payload)
  return { communitySlug: 'naidu-community', familyHeadName: 'Sample family', phoneNumber: '9876543210', alternatePhone: '+91 8765432109', district: 'Chennai', villageName: 'Sample town', address: '10, Sample street', members: [{ name: 'Sample', occupation: 'Government employee', workLocation: 'Chennai' }], governmentSchemes: ['Pension', 'Health insurance'], housingType: 'Leased house', consent: true }
}
async function submit(input) {
  let status = 200, body
  const res = { status: value => { status = value; return res }, json: value => { body = value } }
  await controller.createFamily({ body: input }, res, error => { throw error })
  return { status, body }
}

test('merged registration stores multiple benefits, leased housing and work location', async t => {
  const { status, body } = await submit(fixture(t))
  assert.equal(status, 201)
  assert.equal(body.data.governmentSchemes, 'Pension, Health insurance')
  assert.equal(body.data.housingType, 'Leased house')
  assert.equal(body.data.members[0].workLocation, 'Chennai')
  assert.match(body.data.receiptToken, /^[a-f0-9]{64}$/)
  assert.equal(body.data.receiptTokenHash, undefined)
  assert.equal(body.data.receiptExpiresAt, undefined)
  assert.ok(sections[0].fields.some(field => field.type === 'location'))
  assert.equal(sections.some(section => section.key === 'location'), false)
})

test('submission rejects invalid primary and alternate phones and contradictory benefits', async t => {
  const input = fixture(t)
  assert.equal((await submit({ ...input, phoneNumber: '1234567890' })).status, 400)
  assert.equal((await submit({ ...input, alternatePhone: '98765' })).status, 400)
  assert.equal((await submit({ ...input, governmentSchemes: ['None', 'Pension'] })).status, 400)
  assert.equal((await submit({ ...input, governmentSchemes: ['Unlisted scheme'] })).status, 400)
})

function locationFixture(t, known = true) {
  t.mock.method(District, 'findById', () => lean({ _id: districtId, nameEnglish: 'Chennai', code: '538', stateCode: 'TN' }))
  t.mock.method(LocationChoice, 'findOne', () => lean({ _id: villageId, nameEnglish: 'Sample town' }))
  t.mock.method(Pincode, 'findOne', query => {
    assert.equal(query.code, '600001')
    return lean(known ? { _id: pincodeId, code: '600001' } : null)
  })
  return { stateCode: 'TN', settlementType: 'Urban', districtId, villageChoiceId: villageId, postalCode: '600001' }
}

test('typed PIN resolves a matching directory entry', async t => {
  const result = await collection.resolveLocation(locationFixture(t), true, communityId)
  assert.equal(result.postalCode, '600001')
  assert.equal(result.pincodeId, pincodeId)
})

test('valid typed PIN is saved even when absent from the imported directory', async t => {
  const input = locationFixture(t, false)
  const result = await collection.resolveLocation(input, true, communityId)
  assert.equal(result.postalCode, '600001')
  assert.equal(result.pincodeId, undefined)
  await assert.rejects(collection.resolveLocation({ ...input, postalCode: '000000' }, true, communityId), /6-digit/)
  await assert.rejects(collection.resolveLocation({ ...input, postalCode: '' }, true, communityId), /PIN code/)
})

test('urban town can be entered manually without inventing a village directory ID', async t => {
  const input = locationFixture(t)
  const result = await collection.resolveLocation({ ...input, villageChoiceId: '', villageManual: true, villageName: 'Sample town' }, true, communityId)
  assert.equal(result.villageName, 'Sample town')
  assert.equal(result.villageManual, true)
  assert.equal(result.villageChoiceId, undefined)
  await assert.rejects(collection.resolveLocation({ ...input, villageChoiceId: '', villageManual: true, villageName: '' }, true, communityId), /village or town/)
  await assert.rejects(collection.resolveLocation({ ...input, villageChoiceId: '', villageManual: false, villageName: 'Unverified text' }, true, communityId), /village or town/)
})

test('default forms upgrade with historical versions preserved', async t => {
  const form = new FormConfiguration({ communityId, activeVersion: 1, versions: [{ version: 1, templateKey: 'family-directory-v3', status: 'PUBLISHED', sections: require('../src/config/communityFormV3.json') }] })
  t.mock.method(FormConfiguration, 'findOneAndUpdate', async () => form)
  t.mock.method(form, 'save', async () => form)
  await communities.ensureForm(communityId)
  assert.equal(form.activeVersion, 2)
  assert.equal(form.versions[0].status, 'ARCHIVED')
  assert.equal(form.versions[1].templateKey, 'family-directory-v4')
  assert.ok(form.versions[0].sections.some(section => section.key === 'location'))
  assert.equal(form.versions[1].sections.some(section => section.key === 'location'), false)
})

test('administrator edits and pending drafts are preserved during template upgrade', async t => {
  const form = new FormConfiguration({ communityId, activeVersion: 1, versions: [{ version: 1, templateKey: 'family-directory-v3', status: 'PUBLISHED', sections: require('../src/config/communityFormV3.json') }] })
  form.versions[0].sections[0].description = 'Custom instructions'
  t.mock.method(FormConfiguration, 'findOneAndUpdate', async () => form)
  await communities.ensureForm(communityId)
  assert.equal(form.activeVersion, 1)
  form.versions[0].sections[0].description = require('../src/config/communityFormV3.json')[0].description
  form.versions.push({ version: 2, status: 'DRAFT', sections })
  await communities.ensureForm(communityId)
  assert.equal(form.activeVersion, 1)
})
