const express = require('express')
const cors = require('cors')
const familyRoutes = require('./routes/familyRoutes')
const adminRoutes = require('./routes/adminRoutes')
const app = express()
const origins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map(x => x.trim()).filter(Boolean)
const isAllowedVercelOrigin = origin => /^https:\/\/tamil-registration-frontend(?:-[a-z0-9-]+-kows3002-projects)?\.vercel\.app$/i.test(origin || '')
app.use(cors({ origin: (origin, cb) => !origin || origins.includes(origin) || isAllowedVercelOrigin(origin) ? cb(null, true) : cb(new Error('Origin not allowed by CORS')), credentials: false }))
app.use(express.json({ limit: '1mb' }))
app.get('/api/health', (req, res) => res.json({ success: true, data: { status: 'ok' } }))
app.use('/api/families', familyRoutes)
app.use('/api/admin', adminRoutes)
app.use((req, res) => res.status(404).json({ success: false, message: 'இந்த API வழி கிடைக்கவில்லை.' }))
app.use((err, req, res, next) => {
  console.error(err.message)
  if (err.name === 'ValidationError') return res.status(400).json({ success: false, message: Object.values(err.errors).map(x => x.message).join(' ') })
  if (err.code === 11000) return res.status(409).json({ success: false, message: 'இந்த நிர்வாகி பயனர் பெயர் ஏற்கனவே உள்ளது.' })
  if (err.name === 'CastError') return res.status(400).json({ success: false, message: 'தவறான தரவு.' })
  if (err.message === 'Origin not allowed by CORS') return res.status(403).json({ success: false, message: 'இந்த தளத்திற்கு அனுமதி இல்லை.' })
  res.status(500).json({ success: false, message: 'சேவையகப் பிழை. மீண்டும் முயற்சிக்கவும்.' })
})
module.exports = app



