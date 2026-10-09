require('dotenv').config({ quiet: true })
const mongoose = require('mongoose')
const Family = require('../src/models/Family')
const Community = require('../src/models/Community')
const assert = require('node:assert/strict')
const { listFamilies } = require('../src/controllers/familyController')
const timer = setTimeout(() => { console.error('Database connection timed out.'); process.exit(1) }, 18000)
;(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 12000 })
  const groups = await Family.aggregate([
    { $group: { _id: { communityId: '$communityId', status: '$status' }, families: { $sum: 1 }, members: { $sum: { $size: { $ifNull: ['$members', []] } } } } },
  ])
  const communities = await Community.find().select('name').lean()
  console.log(JSON.stringify(groups.map(row => ({ community: communities.find(item => String(item._id) === String(row._id.communityId))?.name || 'Missing community', status: row._id.status, families: row.families, members: row.members })), null, 2))
  let records
  const response = { json(value) { records = value.data } }
  await listFamilies({ admin: { role: 'SUPER_ADMIN' } }, response, error => { throw error })
  const expected = groups.filter(row => row._id.status !== 'ARCHIVED').reduce((sum, row) => sum + row.families, 0)
  assert.equal(records.length, expected)
  assert.equal(new Set(records.map(record => String(record._id))).size, expected)
  assert(records.every(record => record.communityName && !record.receiptTokenHash))
  for (const group of groups.filter(row => row._id.status !== 'ARCHIVED')) {
    const id = group._id.communityId
    await listFamilies({ admin: { role: 'VIEWER', communityIds: [id] } }, response, error => { throw error })
    assert(records.every(record => String(record.communityId) === String(id)))
  }
  console.log(`PASS: all-community register returns ${expected} unique families; assigned-community scope and receipt secrecy verified.`)
})().catch(() => { console.error('Unable to check the database.'); process.exitCode = 1 }).finally(async () => { clearTimeout(timer); await mongoose.disconnect() })
