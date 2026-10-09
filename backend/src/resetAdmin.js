require('dotenv').config()
const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const Admin = require('./models/Admin')

function readHidden(prompt) {
  const input = process.stdin
  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    throw new Error('Run this command in a terminal so the password can be entered without echo.')
  }
  return new Promise((resolve, reject) => {
    let value = ''
    const restore = () => {
      input.removeListener('data', onData)
      input.setRawMode(false)
      input.pause()
    }
    const onData = (buffer) => {
      for (const key of buffer.toString('utf8')) {
        if (key === '\u0003') { restore(); reject(new Error('Cancelled.')); return }
        if (key === '\r' || key === '\n') { restore(); process.stdout.write('\n'); resolve(value); return }
        if (key === '\u007f' || key === '\b') { value = value.slice(0, -1); continue }
        if (key >= ' ') value += key
      }
    }
    process.stdout.write(prompt)
    input.setRawMode(true)
    input.resume()
    input.on('data', onData)
  })
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not configured in backend/.env')
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured in backend/.env')
  const username = (process.argv[2] || 'Adminshree').trim().toLowerCase()
  const superAdmin = process.argv.includes('--super-admin')
  const password = await readHidden(`New password for ${username}: `)
  if (password.length < 12) throw new Error('Use a password with at least 12 characters.')
  const confirmation = await readHidden('Confirm new password: ')
  if (password !== confirmation) throw new Error('Passwords do not match.')
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 })
  const passwordHash = await bcrypt.hash(password, 12)
  const existing = await Admin.findOne({ username }).select('role').lean()
  if (!existing && !superAdmin) throw new Error('To create the platform administrator, run npm.cmd run reset-admin -- Adminshree --super-admin.')
  await Admin.updateOne({ username }, { $set: { username, password: passwordHash, status: 'ACTIVE', ...(superAdmin ? { role: 'SUPER_ADMIN' } : {}) } }, { upsert: true, runValidators: true })
  console.log(`Admin credentials saved for "${username === 'adminshree' ? 'Adminshree' : username}"${superAdmin ? ' (platform administrator)' : ''}.`)
}

main()
  .catch((error) => { console.error(`Admin reset failed: ${error.message}`); process.exitCode = 1 })
  .finally(() => mongoose.disconnect())
