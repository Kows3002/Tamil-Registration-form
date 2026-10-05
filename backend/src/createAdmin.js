require('dotenv').config()
const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const Admin = require('./models/Admin')

async function main() {
  const [username, password] = process.argv.slice(2)
  if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI in backend/.env first.')
  if (!username || !password || password.length < 10) throw new Error('Usage: npm run create-admin -- <username> <password-at-least-10-chars>')
  await mongoose.connect(process.env.MONGODB_URI)
  const normalized = username.toLowerCase().trim()
  if (await Admin.exists({ username: normalized })) throw new Error(`Admin "${normalized}" already exists.`)
  const admin = await Admin.create({ username: normalized, password: await bcrypt.hash(password, 12) })
  console.log(`Admin created: ${admin.username}`)
}
main().catch(error => { console.error(error.message); process.exitCode = 1 }).finally(() => mongoose.disconnect())
