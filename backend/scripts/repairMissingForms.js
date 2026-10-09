require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env'), quiet: true })
const mongoose = require('mongoose')
const Community = require('../src/models/Community')
const FormConfiguration = require('../src/models/FormConfiguration')
const { ensureForm } = require('../src/controllers/communityController')
;(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 })
  const existing = new Set((await FormConfiguration.distinct('communityId')).map(String))
  const communities = await Community.find({ status: 'ACTIVE' }).select('_id name').lean()
  let repaired = 0
  for (const community of communities) {
    if (existing.has(String(community._id))) continue
    const form = await ensureForm(community._id)
    if (!form.versions.some(version => version.status === 'PUBLISHED' && version.version === form.activeVersion)) throw new Error(`No published template for ${community.name}.`)
    repaired++
  }
  console.log(`Ready: ${communities.length} active communities. Added ${repaired} missing prebuilt forms; existing forms and registrations preserved.`)
})().catch(error => { console.error(error.message); process.exitCode = 1 }).finally(() => mongoose.disconnect())
