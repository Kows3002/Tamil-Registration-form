const { test } = require('node:test')
const assert = require('node:assert/strict')
const { filterFor, csvCell } = require('../src/controllers/reportController')
const { issueReceipt, hashReceiptToken } = require('../src/utils/receipt')
const { createRegistrationPdf, filename } = require('../src/utils/registrationPdf')
const controller = require('../src/controllers/familyController')
const Family = require('../src/models/Family')
const { requirePermission } = require('../src/middleware/adminAccess')
const communityId = 'aaaaaaaaaaaaaaaaaaaaaaaa', otherId = 'bbbbbbbbbbbbbbbbbbbbbbbb'

test('reports are limited to assigned communities and reject unauthorized community filters', () => {
  const admin = { role: 'COMMUNITY_ADMIN', communityIds: [communityId] }
  assert.equal(String(filterFor(admin, {}).communityId.$in[0]), communityId)
  assert.equal(String(filterFor(admin, { communityId }).communityId), communityId)
  assert.throws(() => filterFor(admin, { communityId: otherId }), error => error.status === 403)
  assert.throws(() => filterFor(admin, { communityId: 'invalid' }), /valid community/)
  assert.equal(filterFor({ role: 'SUPER_ADMIN' }, {}).communityId, undefined)
  assert.deepEqual(filterFor({ role: 'VIEWER', communityIds: [] }, {}).communityId.$in, [])
})

test('report filtering uses literal search, India date boundaries, and excludes archived records', () => {
  const filter = filterFor({ role: 'SUPER_ADMIN' }, { district: 'Erode', search: 'Name.*', from: '2026-10-01', to: '2026-10-09' })
  assert.equal(filter.district, 'Erode')
  assert.equal(filter.status.$ne, 'ARCHIVED')
  assert.equal(filter.$or[0].familyHeadName.test('Name.*'), true)
  assert.equal(filter.$or[0].familyHeadName.test('Name anything'), false)
  assert.equal(filter.createdAt.$gte.toISOString(), '2026-09-30T18:30:00.000Z')
  assert.equal(filter.createdAt.$lte.toISOString(), '2026-10-09T18:29:59.999Z')
  assert.throws(() => filterFor({ role: 'SUPER_ADMIN' }, { from: '2026-02-30' }), /valid report date/)
  assert.throws(() => filterFor({ role: 'SUPER_ADMIN' }, { status: 'ARCHIVED' }), /valid registration status/)
  assert.throws(() => filterFor({ role: 'SUPER_ADMIN' }, { from: '2026-10-09', to: '2026-10-01' }), /start date/)
})

test('all-community family register respects assigned communities and labels each family once', async t => {
  let actualFilter, response
  const Community = require('../src/models/Community')
  t.mock.method(Family, 'find', filter => { actualFilter = filter; return { sort: () => ({ lean: async () => [{ _id: otherId, communityId, members: [{ name: 'Test' }] }] }) } })
  t.mock.method(Community, 'find', () => ({ select: () => ({ lean: async () => [{ _id: communityId, name: 'Naidu Community' }] }) }))
  const res = { json(value) { response = value.data } }
  await controller.listFamilies({ admin: { role: 'VIEWER', communityIds: [communityId] } }, res, error => { throw error })
  assert.equal(String(actualFilter.communityId.$in[0]), communityId)
  assert.equal(actualFilter.status.$ne, 'ARCHIVED')
  assert.equal(response.length, 1)
  assert.equal(response[0].communityName, 'Naidu Community')
  await controller.listFamilies({ admin: { role: 'SUPER_ADMIN' } }, res, error => { throw error })
  assert.equal(actualFilter.communityId, undefined)
  await controller.listFamilies({ admin: { role: 'SUPER_ADMIN' }, communityId }, res, error => { throw error })
  assert.equal(actualFilter.communityId, communityId)
})

test('CSV exports preserve text safely, including quotes and formula-like user values', () => {
  assert.equal(csvCell('one,"two"'), '"one,""two"""')
  assert.equal(csvCell('=HYPERLINK("bad")'), '"\'=HYPERLINK(""bad"")"')
  assert.equal(csvCell('+919876543210'), '"\'+919876543210"')
  assert.equal(csvCell('நாயுடு'), '"நாயுடு"')
})

test('report routes require reporting permission', () => {
  let denied, allowed = false
  const middleware = requirePermission('reports:read')
  const res = { status: status => { denied = status; return res }, json() {} }
  middleware({ admin: { role: 'DATA_ENTRY_OPERATOR' } }, res, () => { allowed = true })
  assert.equal(denied, 403); assert.equal(allowed, false)
  middleware({ admin: { role: 'SUPER_ADMIN' } }, res, () => { allowed = true })
  assert.equal(allowed, true)
})

test('receipt credentials are random, hashed and expire after 24 hours', () => {
  const first = issueReceipt(), second = issueReceipt()
  assert.match(first.token, /^[a-f0-9]{64}$/)
  assert.notEqual(first.token, second.token)
  assert.notEqual(first.hash, first.token)
  assert.equal(first.hash, hashReceiptToken(first.token))
  assert.ok(first.expiresAt.getTime() - Date.now() > 23 * 60 * 60 * 1000)
})

async function receiptRequest(id, token) {
  let status, body
  const res = { status: value => { status = value; return res }, json: value => { body = value } }
  await controller.publicReceipt({ params: { id }, get: () => token }, res, error => { throw error })
  return { status, body }
}
test('public PDFs cannot be fetched by guessing a family ID or using an expired receipt', async t => {
  assert.equal((await receiptRequest(communityId, '')).status, 403)
  const token = issueReceipt().token
  t.mock.method(Family, 'findOne', filter => {
    assert.equal(filter.receiptTokenHash, hashReceiptToken(token))
    assert.ok(filter.receiptExpiresAt.$gt instanceof Date)
    assert.equal(filter.status.$ne, 'ARCHIVED')
    return { lean: async () => null }
  })
  assert.equal((await receiptRequest(communityId, token)).status, 403)
})

test('PDF generator handles multi-page families and Tamil/English names', async () => {
  const family = { _id: communityId, familyHeadName: 'Sample / குடும்பம்', district: 'Erode', createdAt: new Date(), address: 'Sample address', members: Array.from({ length: 12 }, (_, index) => ({ name: `Member ${index + 1} ரவி`, age: index, relationship: 'Brother', occupation: 'Government employee', workLocation: 'Office, Erode' })), familyAnnualIncome: '₹1–3 lakh', consent: true }
  const community = { name: 'Naidu Community' }
  const pdf = createRegistrationPdf(family, community)
  const chunks = [], completed = new Promise((resolve, reject) => { pdf.on('data', chunk => chunks.push(chunk)); pdf.on('end', resolve); pdf.on('error', reject) })
  pdf.end(); await completed
  const buffer = Buffer.concat(chunks)
  assert.equal(buffer.subarray(0, 5).toString(), '%PDF-')
  assert.ok(buffer.length > 10000)
  assert.match(filename(family, community), /^Naidu-Community-Sample-.*\.pdf$/)
  assert.equal(filename(family, community).includes('/'), false)
})
