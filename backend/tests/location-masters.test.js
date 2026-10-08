const { test } = require('node:test')
const assert = require('node:assert/strict')
const { District, Block, VillagePanchayat, Habitation } = require('../src/models/MasterData')
const Community = require('../src/models/Community')
const LocationChoice = require('../src/models/LocationChoice')
const choices = require('../src/controllers/locationChoiceController')
const masters = require('../src/controllers/masterDataController')
const { resolveLocation } = require('../src/controllers/familyCollection')
const districtId = 'aaaaaaaaaaaaaaaaaaaaaaaa', blockId = 'bbbbbbbbbbbbbbbbbbbbbbbb', villagePanchayatId = 'cccccccccccccccccccccccc', habitationId = 'dddddddddddddddddddddddd', communityId = 'eeeeeeeeeeeeeeeeeeeeeeee'
const lean = data => ({ lean: async () => data })
async function call(handler, query) {
  let status = 200, body
  const res = { status: value => { status = value; return res }, json: value => { body = value; return res } }
  await handler({ query }, res, error => { throw error })
  return { status, body }
}
function parents(t) {
  t.mock.method(Community, 'findOne', () => ({ select: () => lean({ _id: communityId }) }))
  t.mock.method(Block, 'exists', query => query._id === blockId && query.districtId === districtId)
  t.mock.method(VillagePanchayat, 'exists', query => query._id === villagePanchayatId && query.blockId === blockId)
  t.mock.method(Habitation, 'exists', query => query._id === habitationId && query.villagePanchayatId === villagePanchayatId)
}
test('rural village/hamlet list includes imported habitations and preserves provenance', async t => {
  parents(t)
  t.mock.method(LocationChoice, 'find', () => lean([{ _id: communityId, nameEnglish: 'Community village' }]))
  t.mock.method(Habitation, 'find', query => {
    assert.equal(query.villagePanchayatId, villagePanchayatId)
    return lean([{ _id: habitationId, nameEnglish: 'A Hamlet' }, { _id: blockId, nameEnglish: 'Z Hamlet' }])
  })
  const { body } = await call(choices.list, { kind: 'village', districtId, blockId, villagePanchayatId, communitySlug: 'example', limit: '1', page: '1' })
  assert.equal(body.data.pagination.total, 3)
  assert.equal(body.data.items[0].masterHabitationId, habitationId)
  assert.equal(body.data.items[0].locationType, 'habitation')
  assert.equal(body.data.items[0].displayName, 'A Hamlet (hamlet)')
  const secondPage = await call(choices.list, { kind: 'village', districtId, blockId, villagePanchayatId, limit: '1', page: '2' })
  assert.equal(secondPage.body.data.items[0].nameEnglish, 'Community village')
  assert.equal(secondPage.body.data.pagination.pages, 3)
  const searched = await call(choices.list, { kind: 'village', districtId, blockId, villagePanchayatId, search: 'z hamlet' })
  assert.equal(searched.body.data.items.length, 1)
  assert.equal(searched.body.data.items[0].nameEnglish, 'Z Hamlet')
})
test('parent selections from a different district/block are rejected', async t => {
  parents(t)
  assert.equal((await call(choices.list, { kind: 'street', districtId, blockId: communityId })).status, 400)
  assert.equal((await call(choices.list, { kind: 'village', districtId, blockId, villagePanchayatId: communityId })).status, 400)
  assert.equal((await call(choices.list, { kind: 'village', districtId, villagePanchayatId })).status, 400)
})
test('unselected parents do not return entries from other blocks/panchayats', async t => {
  parents(t)
  let filter
  t.mock.method(LocationChoice, 'find', query => {
    filter = query
    const chain = { sort: () => chain, skip: () => chain, limit: () => chain, lean: async () => [] }
    return chain
  })
  t.mock.method(LocationChoice, 'countDocuments', async () => 0)
  await call(choices.list, { kind: 'street', districtId })
  assert.equal(filter.$and.length, 3)
  for (const clause of filter.$and) {
    assert.equal(clause.$or.length, 2)
    assert.ok(clause.$or.some(entry => Object.values(entry)[0] === null))
  }
})
function locationRecords(t, foreign = false) {
  t.mock.method(District, 'findById', () => lean({ _id: districtId, code: '543', stateCode: 'TN', nameEnglish: 'Tiruvallur' }))
  t.mock.method(Block, 'findById', () => lean({ _id: blockId, districtId, nameEnglish: 'Block' }))
  t.mock.method(VillagePanchayat, 'findById', () => lean({ _id: villagePanchayatId, blockId, nameEnglish: 'Panchayat' }))
  t.mock.method(Habitation, 'findById', () => lean({ _id: habitationId, villagePanchayatId: foreign ? communityId : villagePanchayatId, nameEnglish: 'Verified Hamlet' }))
}
const input = { stateCode: 'TN', settlementType: 'Rural', districtId, blockId, villagePanchayatId, habitationId, villageSameAsHabitation: true }
test('selected master hamlet saves canonical village name from its verified parent chain', async t => {
  locationRecords(t)
  const result = await resolveLocation({ ...input, villageName: 'Forged text' }, false, communityId)
  assert.equal(result.villageName, 'Verified Hamlet')
  assert.equal(result.habitationId, habitationId)
  assert.equal(result.villageSameAsHabitation, true)
})
test('cross-panchayat and conflicting village/hamlet selections cannot be saved', async t => {
  locationRecords(t, true)
  await assert.rejects(resolveLocation(input, false, communityId), /selected parent/)
})
test('master hamlet selection requires an ID and cannot also be a community village', async t => {
  locationRecords(t)
  await assert.rejects(resolveLocation({ ...input, habitationId: '' }, false, communityId), /valid village or hamlet/)
  await assert.rejects(resolveLocation({ ...input, villageChoiceId: communityId }, false, communityId), /valid village or hamlet/)
  await assert.rejects(resolveLocation({ ...input, villageSameAsPanchayat: true }, false, communityId), /valid village or hamlet/)
})
test('master searches include real English names even when search-index fields are missing', async t => {
  let filter, sorting
  const chain = { sort: value => { sorting = value; return chain }, skip: () => chain, limit: () => chain, lean: () => chain, exec: async () => [] }
  t.mock.method(Block, 'find', query => { filter = query; return chain })
  t.mock.method(Block, 'countDocuments', async () => 0)
  await call(masters.blocks, { districtId, search: 'A' })
  assert.equal(String(filter.$and[0].districtId), districtId)
  assert.ok(filter.$and[1].$or.some(entry => entry.nameEnglish instanceof RegExp))
  assert.ok(filter.$and[1].$or.some(entry => entry.nameTamil instanceof RegExp))
  assert.equal(sorting._id, 1)
})
