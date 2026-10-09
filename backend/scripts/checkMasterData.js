const path = require('node:path')
const assert = require('node:assert/strict')
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true })
const mongoose = require('mongoose')
const app = require('../src/app')
const models = require('../src/models/MasterData')
const Community = require('../src/models/Community')
const { resolveLocation } = require('../src/controllers/familyCollection')

async function main() {
  let server
  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 })
    const counts = Object.fromEntries(await Promise.all(Object.entries(models).map(async ([name, model]) => [name, await model.countDocuments({})])))
    assert.ok(Object.values(counts).every(count => count > 0), 'One or more master collections are empty. Run import:master first.')
    console.log('Master counts:', JSON.stringify(counts))
    for (const [child, parent, field] of [[models.Block, models.District, 'districtId'], [models.VillagePanchayat, models.Block, 'blockId'], [models.Habitation, models.VillagePanchayat, 'villagePanchayatId'], [models.PostOffice, models.Pincode, 'pincodeId']]) {
      const orphans = await child.aggregate([{ $lookup: { from: parent.collection.name, localField: field, foreignField: '_id', as: 'parent' } }, { $match: { parent: { $size: 0 } } }, { $count: 'count' }])
      assert.equal(orphans[0]?.count || 0, 0, `${child.collection.name} contains orphan parent references`)
      console.log(`PASS ${child.collection.name} -> ${parent.collection.name} parent references`)
    }
    const habitation = await models.Habitation.findOne({}).lean()
    const village = await models.VillagePanchayat.findById(habitation.villagePanchayatId).lean()
    const block = await models.Block.findById(village.blockId).lean()
    const district = await models.District.findById(block.districtId).lean()
    const postOffice = await models.PostOffice.findOne({}).lean()
    const community = await Community.findOne({ status: 'ACTIVE', 'settings.allowPublicRegistration': true }).select('_id slug').lean()
    assert.ok(community, 'Start the backend once to initialize communities.')
    server = app.listen(0, '127.0.0.1')
    await new Promise(resolve => server.once('listening', resolve))
    const base = `http://127.0.0.1:${server.address().port}/api/master`
    const checks = [
      ['states', item => item.code === 'TN'],
      ['districts?stateCode=TN&limit=100', item => String(item._id) === String(district._id)],
      [`blocks?districtId=${district._id}`, item => String(item.districtId) === String(district._id)],
      [`village-panchayats?blockId=${block._id}`, item => String(item.blockId) === String(block._id)],
      [`habitations?villagePanchayatId=${village._id}`, item => String(item.villagePanchayatId) === String(village._id)],
      ['assembly-constituencies', item => Boolean(item.nameEnglish)],
      ['pincodes', item => /^[1-9]\d{5}$/.test(item.code)],
      [`post-offices?pincodeId=${postOffice.pincodeId}`, item => String(item.pincodeId) === String(postOffice.pincodeId)],
      [`location-choices?kind=taluk&communitySlug=${community.slug}&districtId=${district._id}`, item => Boolean(item.nameEnglish)],
      [`location-choices?kind=village&communitySlug=${community.slug}&districtId=${district._id}&blockId=${block._id}&villagePanchayatId=${village._id}`, item => Boolean(item.nameEnglish)],
    ]
    for (const [endpoint, check] of checks) {
      const response = await fetch(`${base}/${endpoint}`)
      assert.equal(response.status, 200, endpoint)
      const { data } = await response.json()
      assert.ok(data.items.length > 0 && data.items.some(check), endpoint)
      if (endpoint.startsWith('districts')) assert.equal(data.pagination.total, counts.District)
      if (endpoint.startsWith('blocks') || endpoint.startsWith('village-panchayats') || endpoint.startsWith('habitations') || endpoint.startsWith('post-offices')) assert.ok(data.items.every(check), `Parent scope: ${endpoint}`)
      console.log(`PASS ${endpoint.split('?')[0]}: ${data.pagination.total} matching options`)
    }
    const location = await resolveLocation({ stateCode: 'TN', settlementType: 'Rural', districtId: String(district._id), blockId: String(block._id), villagePanchayatId: String(village._id), habitationId: String(habitation._id), villageSameAsHabitation: true, postalCode: postOffice.pincode, pincodeId: String(postOffice.pincodeId), postOfficeId: String(postOffice._id) }, true, community._id)
    assert.equal(String(location.habitationId), String(habitation._id))
    assert.equal(location.postalCode, postOffice.pincode)
    console.log('PASS complete location selection validation (read only)')
    console.log('Ward and street choices are community-managed; no entries are invented for missing local data.')
  } finally {
    if (server) await new Promise(resolve => server.close(resolve))
    await mongoose.disconnect()
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
