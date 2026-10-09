require('dotenv').config()
const app = require('./app')
const connectDB = require('./config/db')
const mongoose = require('mongoose')
const Community = require('./models/Community')
const Admin = require('./models/Admin')
const Family = require('./models/Family')
const communityController = require('./controllers/communityController')
const port = process.env.PORT || 5000
async function prepareTenantFoundation() {
  const legacyCommunity = await Community.findOneAndUpdate(
    { code: 'KRISHNAN' },
    { $setOnInsert: { code: 'KRISHNAN', slug: 'krishnan-community', name: 'Krishnan Community', description: 'Existing family registration community.' } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
  await Family.updateMany({ communityId: { $exists: false } }, { $set: { communityId: legacyCommunity._id, formVersion: 1 } })
  await Family.updateMany({ 'members.communityId': { $exists: false } }, [{ $set: { members: { $map: { input: { $ifNull: ['$members', []] }, as: 'member', in: { $mergeObjects: ['$$member', { communityId: { $ifNull: ['$$member.communityId', '$communityId'] } }] } } } } }], { updatePipeline: true })
  await Admin.updateMany({ role: { $exists: false } }, { $set: { role: 'SUPER_ADMIN', communityIds: [legacyCommunity._id], status: 'ACTIVE' } })
  await Admin.updateMany({ status: { $exists: false } }, { $set: { status: 'ACTIVE' } })
  await Admin.updateMany({ role: 'COMMUNITY_ADMIN', communityIds: { $size: 0 } }, { $set: { communityIds: [legacyCommunity._id] } })
  await communityController.ensureForm(legacyCommunity._id)
  // Add the public directory without changing existing profiles or access settings.
  const directory = require('./config/communities.json')
  await Community.bulkWrite(directory.map(([, english], index) => ({ updateOne: {
    filter: { slug: `${english.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '').slice(0, 50)}-community` },
    update: { $setOnInsert: { name: `${english} Community`, code: `COMMUNITY-${String(index + 1).padStart(3, '0')}`, description: 'Family information register.', status: 'ACTIVE', settings: { allowPublicRegistration: true, defaultLanguage: 'en' } } },
    upsert: true,
  } })))
  console.log(`Tenant foundation ready: ${mongoose.connection.name}`)
}
async function start() {
  try {
    console.log(`Master-data routes registered: ${app.locals.masterDataGetRoutes.join(', ')}`)
    await connectDB()
    await prepareTenantFoundation()
    app.listen(port, () => console.log(`API listening on ${port}`))
  } catch (error) {
    console.error(`MongoDB connection failed: ${error.message}`)
    process.exitCode = 1
  }
}
start()
