const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const Admin = require('../models/Admin')
const Community = require('../models/Community')

exports.login = async (req, res, next) => {
  try { const { username, password } = req.body; if (!username || !password) return res.status(400).json({ success: false, message: 'Username and password are required.' }); const admin = await Admin.findOne({ username: String(username).toLowerCase().trim(), status: 'ACTIVE' }).select('+password'); if (!admin || !(await bcrypt.compare(password, admin.password))) return res.status(401).json({ success: false, message: 'Incorrect username or password.' }); const token = jwt.sign({ sub: admin._id.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' }); res.json({ success: true, data: { token, admin: { id: admin._id, username: admin.username, role: admin.role, communityIds: admin.communityIds } } }) } catch (e) { next(e) }
}
exports.me = async (req, res, next) => { try { const admin = await Admin.findById(req.admin._id).select('_id username role communityIds').lean(); res.json({ success: true, data: admin }) } catch (error) { next(error) } }

const communityRoles = ['COMMUNITY_ADMIN', 'COMMUNITY_MANAGER', 'DATA_ENTRY_OPERATOR', 'VERIFIER', 'VIEWER']
exports.listUsers = async (req, res, next) => {
  try { const users = await Admin.find().select('_id username role communityIds status createdAt').sort({ createdAt: -1 }).lean(); res.json({ success: true, data: users }) }
  catch (error) { next(error) }
}

exports.createUser = async (req, res, next) => {
  try {
    const { username, password, role, communityIds = [] } = req.body || {}
    const normalized = String(username || '').trim().toLowerCase()
    if (!/^[a-z0-9._@+-]{3,120}$/.test(normalized) || typeof password !== 'string' || password.length < 12) return res.status(400).json({ success: false, message: 'Provide a valid username and a password of at least 12 characters.' })
    if (!communityRoles.includes(role)) return res.status(400).json({ success: false, message: 'Choose a community-level role. Platform administrators must be provisioned separately.' })
    if (!Array.isArray(communityIds) || !communityIds.length || communityIds.some(id => !require('mongoose').isValidObjectId(id))) return res.status(400).json({ success: false, message: 'Assign this user to at least one community.' })
    const communities = await Community.countDocuments({ _id: { $in: communityIds }, status: 'ACTIVE' })
    if (communities !== new Set(communityIds.map(String)).size) return res.status(400).json({ success: false, message: 'One or more selected communities are inactive or unavailable.' })
    const created = await Admin.create({ username: normalized, password: await bcrypt.hash(password, 12), role, communityIds: [...new Set(communityIds.map(String))] })
    res.status(201).json({ success: true, data: { _id: created._id, username: created.username, role: created.role, communityIds: created.communityIds, status: created.status, createdAt: created.createdAt } })
  } catch (error) { next(error) }
}

exports.updateUser = async (req, res, next) => {
  try {
    const mongoose = require('mongoose')
    if (!mongoose.isValidObjectId(req.params.id) || String(req.params.id) === String(req.admin._id)) return res.status(400).json({ success: false, message: 'Choose another valid admin account.' })
    const { role, status, communityIds } = req.body || {}
    if (role !== undefined && !communityRoles.includes(role)) return res.status(400).json({ success: false, message: 'Platform administrator role cannot be assigned through this action.' })
    if (status !== undefined && !['ACTIVE', 'INACTIVE'].includes(status)) return res.status(400).json({ success: false, message: 'Choose an active or inactive status.' })
    const changes = {}
    if (role !== undefined) changes.role = role
    if (status !== undefined) changes.status = status
    if (communityIds !== undefined) {
      if (!Array.isArray(communityIds) || !communityIds.length || communityIds.some(id => !mongoose.isValidObjectId(id))) return res.status(400).json({ success: false, message: 'Assign the user to at least one community.' })
      const count = await Community.countDocuments({ _id: { $in: communityIds }, status: 'ACTIVE' })
      if (count !== new Set(communityIds.map(String)).size) return res.status(400).json({ success: false, message: 'One or more selected communities are inactive or unavailable.' })
      changes.communityIds = [...new Set(communityIds.map(String))]
    }
    const user = await Admin.findByIdAndUpdate(req.params.id, { $set: changes }, { new: true, runValidators: true }).select('_id username role communityIds status createdAt').lean()
    if (!user) return res.status(404).json({ success: false, message: 'Admin user not found.' })
    res.json({ success: true, data: user })
  } catch (error) { next(error) }
}
