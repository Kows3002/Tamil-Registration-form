const { test } = require('node:test')
const assert = require('node:assert/strict')
const controller = require('../src/controllers/communityController')
const FormConfiguration = require('../src/models/FormConfiguration')
const Community = require('../src/models/Community')
const communityId = 'aaaaaaaaaaaaaaaaaaaaaaaa'

function mockStore(t) {
  let stored
  t.mock.method(FormConfiguration, 'findOneAndUpdate', async (filter, update) => {
    assert.equal(String(filter.communityId), communityId)
    if (!stored) {
      stored = new FormConfiguration(update.$setOnInsert)
      t.mock.method(stored, 'save', async () => stored)
    }
    return stored
  })
  t.mock.method(FormConfiguration, 'findOne', async () => stored)
  return () => stored
}
async function call(handler, req) {
  let status = 200, body
  const res = { status(value) { status = value; return this }, json(value) { body = value } }
  await handler(req, res, error => { throw error })
  return { status, body }
}
test('admin opening an unconfigured community gets the full prebuilt template, never null', async t => {
  const store = mockStore(t)
  const response = await call(controller.getForm, { communityId })
  assert.equal(response.status, 200)
  assert.equal(response.body.data.versions[0].status, 'PUBLISHED')
  assert.equal(response.body.data.versions[0].sections.length, 5)
  assert.equal(store().versions[0].sections[0].fields.find(field => field.key === 'district').type, 'location')
  await call(controller.getForm, { communityId })
  assert.equal(store().versions.length, 1)
})
test('edit, add required question, save draft and publish change the public form while preserving old versions', async t => {
  const store = mockStore(t)
  await call(controller.getForm, { communityId })
  const sections = store().versions[0].toObject().sections
  sections[0].title = 'Family and residential details'
  sections[0].fields.find(field => field.key === 'email').required = true
  sections[0].fields.push({ key: 'custom_language', label: 'Preferred language', type: 'select', options: ['Tamil', 'English'], required: true, visible: true, order: 20 })
  const saved = await call(controller.saveDraft, { communityId, body: { sections } })
  assert.equal(saved.status, 200)
  assert.equal(store().activeVersion, 1)
  assert.equal(store().versions[0].sections[0].title, 'Primary & residential information')
  const draft = store().versions[1]
  assert.equal(draft.templateKey, 'family-directory-v4')
  await call(controller.publishForm, { communityId, params: { versionId: String(draft._id) } })
  assert.equal(store().activeVersion, 2)
  assert.equal(store().versions[0].status, 'ARCHIVED')
  t.mock.method(Community, 'findOne', () => ({ lean: async () => ({ _id: communityId, name: 'Sample community', slug: 'sample-community' }) }))
  const publicForm = await call(controller.publicBySlug, { params: { slug: 'sample-community' } })
  assert.equal(publicForm.body.data.form.version, 2)
  assert.equal(publicForm.body.data.form.sections[0].title, sections[0].title)
  assert.equal(publicForm.body.data.form.sections[0].fields.find(field => field.key === 'email').required, true)
  assert.deepEqual(publicForm.body.data.form.sections[0].fields.find(field => field.key === 'custom_language').options, ['Tamil', 'English'])
})
