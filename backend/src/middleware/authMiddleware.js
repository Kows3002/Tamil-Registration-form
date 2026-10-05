const jwt = require('jsonwebtoken')

module.exports = function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null
  if (!token) return res.status(401).json({ success: false, message: 'நிர்வாகியாக உள்நுழையவும்.' })
  try { req.admin = jwt.verify(token, process.env.JWT_SECRET); next() }
  catch { return res.status(401).json({ success: false, message: 'உள்நுழைவு காலாவதியானது. மீண்டும் உள்நுழையவும்.' }) }
}
