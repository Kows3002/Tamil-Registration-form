const { test } = require('node:test')
const assert = require('node:assert/strict')
const directory = require('../src/config/communities.json')
const Community = require('../src/models/Community')
const controller = require('../src/controllers/communityController')

test('directory preserves all 84 entries and distinct registration URLs', () => {
  assert.equal(directory.length, 84)
  assert.deepEqual(directory[9], ['நாயுடு', 'Naidu'])
  const slugs = directory.map(([, name]) => `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '').slice(0, 50)}-community`)
  assert.equal(new Set(slugs).size, 84)
  assert.ok(directory.every(([tamil, name]) => tamil && name && `${name} Community`.length <= 120))
})

test('public directory only exposes active, public community names and slugs', async t => {
  const communities = [{ _id: 'example', name: 'Naidu Community', slug: 'naidu-community' }]
  t.mock.method(Community, 'find', filter => {
    assert.deepEqual(filter, { status: 'ACTIVE', 'settings.allowPublicRegistration': true })
    return { select(fields) {
      assert.equal(fields, 'name slug')
      return { sort(order) {
        assert.deepEqual(order, { name: 1 })
        return { lean: async () => communities }
      } }
    } }
  })
  let response
  await controller.publicList({}, { json: value => { response = value } }, error => { throw error })
  assert.deepEqual(response, { success: true, data: communities })
})

test('public directory forwards database failures', async t => {
  const error = new Error('Directory unavailable')
  t.mock.method(Community, 'find', () => { throw error })
  let forwarded
  await controller.publicList({}, { json: () => assert.fail('Should not send success') }, value => { forwarded = value })
  assert.equal(forwarded, error)
})
