const { test, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const { taluksForDistrict, mergeTaluks } = require('../src/config/taluks')
const directory = require('../src/config/taluks.json')
const { District } = require('../src/models/MasterData')
const Community = require('../src/models/Community')
const LocationChoice = require('../src/models/LocationChoice')
const controller = require('../src/controllers/locationChoiceController')
const { resolveLocation } = require('../src/controllers/familyCollection')
const district = { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', code: '560', stateCode: 'TN', nameEnglish: 'Ariyalur' }
const communityId = 'bbbbbbbbbbbbbbbbbbbbbbbb'
afterEach(() => require('node:test').mock.restoreAll())
const lean = value => ({ lean: async () => value })
function stub(t, choices = [], selectedDistrict = district) {
  t.mock.method(District, 'findById', () => lean(selectedDistrict))
  t.mock.method(Community, 'findOne', () => ({ select: () => lean({ _id: communityId }) }))
  t.mock.method(LocationChoice, 'find', query => {
    assert.equal(String(query.communityId), communityId)
    assert.equal(String(query.districtId), district._id)
    assert.equal(query.kind, 'taluk')
    return lean(choices)
  })
}
async function list(query = {}) {
  let body, status = 200
  const res = { status: code => { status = code; return res }, json: value => { body = value; return res } }
  await controller.list({ query: { communitySlug: 'example', kind: 'taluk', districtId: district._id, ...query } }, res, error => { throw error })
  return { body, status }
}
test('every imported district has a sourced list and unique stable application keys', () => {
  assert.equal(Object.keys(directory.districts).length, 37)
  const ids = new Set()
  for (const [code, entry] of Object.entries(directory.districts)) {
    assert.match(entry.sourceUrl, /^https:\/\/[^/]+\.nic\.in\//)
    assert.ok(entry.taluks.length)
    const records = taluksForDistrict({ ...district, code })
    for (const record of records) { assert.ok(!ids.has(record.talukCode)); ids.add(record.talukCode) }
  }
})
test('taluks are filtered by district code and state, never by block names', () => {
  assert.deepEqual(taluksForDistrict(district).map(x => x.nameEnglish), ['Andimadam', 'Ariyalur', 'Sendurai', 'Udayarpalayam'])
  assert.ok(!taluksForDistrict({ ...district, code: '523' }).some(x => x.nameEnglish === 'Sendurai'))
  assert.deepEqual(taluksForDistrict({ ...district, stateCode: 'KA' }), [])
  assert.deepEqual(taluksForDistrict({ ...district, code: 'unknown' }), [])
})
test('community overrides replace duplicates and inactive entries hide bundled names', () => {
  const records = mergeTaluks(district, [{ _id: 'custom', nameEnglish: ' ariyalur ', status: 'ACTIVE' }, { nameEnglish: 'SENDURAI', status: 'INACTIVE' }])
  assert.equal(records.length, 3)
  assert.ok(records.some(x => x._id === 'custom'))
  assert.ok(!records.some(x => x.nameEnglish === 'Sendurai'))
})
test('empty community directory still returns district taluks', async t => {
  stub(t)
  const { status, body } = await list()
  assert.equal(status, 200)
  assert.equal(body.data.pagination.total, 4)
  assert.equal(body.data.items[0].nameEnglish, 'Andimadam')
})
test('search is literal, case-insensitive, and applied before pagination', async t => {
  stub(t)
  const { body } = await list({ search: ' AM ', limit: '1', page: '2' })
  assert.equal(body.data.pagination.total, 2)
  assert.equal(body.data.pagination.pages, 2)
  assert.equal(body.data.items[0].nameEnglish, 'Udayarpalayam')
  assert.equal((await list({ search: '.*' })).body.data.pagination.total, 0)
})
test('invalid district ID and unknown district are rejected', async t => {
  assert.equal((await list({ districtId: 'bad' })).status, 400)
  stub(t, [], null)
  assert.equal((await list()).status, 400)
})
test('bundled taluk saves the canonical name and key without a fake ObjectId', async t => {
  stub(t)
  const taluk = taluksForDistrict(district)[0]
  const result = await resolveLocation({ districtId: district._id, stateCode: 'TN', settlementType: 'Urban', talukCode: taluk.talukCode, taluk: 'Forged name', locationMissing: ['taluk'] }, false, communityId)
  assert.equal(result.taluk, 'Andimadam')
  assert.equal(result.talukCode, taluk.talukCode)
  assert.equal(result.talukChoiceId, undefined)
  assert.deepEqual(result.locationMissing, [])
})
test('cross-district, forged and conflicting taluk selections are rejected', async t => {
  stub(t)
  const input = { districtId: district._id, stateCode: 'TN', settlementType: 'Urban' }
  await assert.rejects(resolveLocation({ ...input, talukCode: taluksForDistrict({ ...district, code: '523' })[0].talukCode }, false, communityId), /selected district/)
  await assert.rejects(resolveLocation({ ...input, talukCode: 'forged' }, false, communityId), /selected district/)
  await assert.rejects(resolveLocation({ ...input, talukCode: taluksForDistrict(district)[0].talukCode, talukChoiceId: communityId }, false, communityId), /only one taluk/)
})
test('inactive or replaced defaults cannot be submitted using stale keys', async t => {
  stub(t, [{ nameEnglish: 'Andimadam', status: 'INACTIVE' }])
  await assert.rejects(resolveLocation({ districtId: district._id, stateCode: 'TN', settlementType: 'Urban', talukCode: taluksForDistrict(district)[0].talukCode }, false, communityId), /current directory/)
})
test('existing community taluk ObjectIds remain supported', async t => {
  stub(t)
  t.mock.method(LocationChoice, 'findOne', query => {
    assert.equal(query.communityId, communityId)
    return lean({ _id: communityId, nameEnglish: 'Community taluk' })
  })
  const result = await resolveLocation({ districtId: district._id, stateCode: 'TN', settlementType: 'Urban', talukChoiceId: communityId }, false, communityId)
  assert.equal(result.taluk, 'Community taluk')
  assert.equal(result.talukChoiceId, communityId)
})
