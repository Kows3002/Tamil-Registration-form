const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const Admin = require('../models/Admin')

exports.login = async (req, res, next) => {
  try { const { username, password } = req.body; if (!username || !password) return res.status(400).json({ success: false, message: 'பயனர் பெயர் மற்றும் கடவுச்சொல்லை உள்ளிடவும்.' }); const admin = await Admin.findOne({ username: String(username).toLowerCase().trim() }).select('+password'); if (!admin || !(await bcrypt.compare(password, admin.password))) return res.status(401).json({ success: false, message: 'பயனர் பெயர் அல்லது கடவுச்சொல் தவறு.' }); const token = jwt.sign({ sub: admin._id.toString(), username: admin.username }, process.env.JWT_SECRET, { expiresIn: '8h' }); res.json({ success: true, data: { token, admin: { username: admin.username } } }) } catch (e) { next(e) }
}
exports.me = async (req, res) => res.json({ success: true, data: { username: req.admin.username } })
