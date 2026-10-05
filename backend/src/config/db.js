const mongoose = require('mongoose')
const dns = require('node:dns')

module.exports = async function connectDB() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not configured')
  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 })
  } catch (error) {
    const detail = `${error.message} ${error.cause?.message || ''}`
    if (/querySrv|ECONNREFUSED|ENOTFOUND|ETIMEOUT/i.test(detail)) {
      throw new Error(`Atlas DNS lookup failed before MongoDB authentication. Node DNS server(s): ${dns.getServers().join(', ') || '(system default)'}. Check the Windows DNS/VPN/filtering resolver, then test SRV lookup with node:dns.resolveSrv.`)
    }
    throw error
  }
  console.log(`MongoDB connected: ${mongoose.connection.name}`)
}
