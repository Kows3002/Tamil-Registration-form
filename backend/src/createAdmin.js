require('dotenv').config()
const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const Admin = require('./models/Admin')
const Community = require('./models/Community')

async function main() {
  const [username, password] = process.argv.slice(2)
  if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI in backend/.env first.')
  if (!username || !password || password.length < 10) throw new Error('Usage: npm run create-admin -- <username> <password-at-least-10-chars>')
  await mongoose.connect(process.env.MONGODB_URI)
  const normalized = username.toLowerCase().trim()
  if (await Admin.exists({ username: normalized })) throw new Error(`Admin "${normalized}" already exists.`)
  const hasAdmins = await Admin.exists({})
  let role = 'SUPER_ADMIN'
  let communityIds = []
  if (hasAdmins) {
    role = process.env.ADMIN_ROLE || ''
    const communityId = process.env.ADMIN_COMMUNITY_ID || ''
    if (!['COMMUNITY_ADMIN', 'COMMUNITY_MANAGER', 'DATA_ENTRY_OPERATOR', 'VERIFIER', 'VIEWER'].includes(role) || !communityId || !(await Community.exists({ _id: communityId, status: 'ACTIVE' }))) {
      throw new Error('An admin already exists. Set ADMIN_ROLE and an active ADMIN_COMMUNITY_ID before creating a community-level user.')
    }
    communityIds = [communityId]
  }
  const admin = await Admin.create({ username: normalized, password: await bcrypt.hash(password, 12), role, communityIds })
  console.log(`Admin created: ${admin.username} (${admin.role})`)
}
main().catch(error => { console.error(error.message); process.exitCode = 1 }).finally(() => mongoose.disconnect())
