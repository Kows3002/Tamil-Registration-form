const mongoose = require('mongoose')
const jwt = require('jsonwebtoken')
const Admin = require('../models/Admin')
const Community = require('../models/Community')

const roles = {
  SUPER_ADMIN: new Set(['*', 'users:manage']),
  COMMUNITY_ADMIN: new Set(['community:read', 'community:update', 'families:read', 'families:write', 'families:verify', 'forms:read', 'forms:write', 'reports:read', 'members:read', 'members:write']),
  COMMUNITY_MANAGER: new Set(['community:read', 'families:read', 'families:write', 'families:verify', 'forms:read', 'reports:read', 'members:read', 'members:write']),
  DATA_ENTRY_OPERATOR: new Set(['community:read', 'families:read', 'families:write', 'forms:read', 'members:read', 'members:write']),
  VERIFIER: new Set(['community:read', 'families:read', 'families:verify', 'members:read']),
  VIEWER: new Set(['community:read', 'families:read', 'forms:read', 'reports:read', 'members:read']),
}

async function authenticateAdmin(req, res, next) {
  const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : ''
  if (!token) return res.status(401).json({ success: false, message: 'Admin login required.' })
  try {
    const claims = jwt.verify(token, process.env.JWT_SECRET)
    if (!mongoose.isValidObjectId(claims.sub)) return res.status(401).json({ success: false, message: 'Invalid admin session.' })
    const admin = await Admin.findOne({ _id: claims.sub, status: 'ACTIVE' }).select('_id username role communityIds status').lean()
    if (!admin) return res.status(401).json({ success: false, message: 'Admin session is no longer active.' })
    req.admin = admin
    next()
  } catch {
    return res.status(401).json({ success: false, message: 'Admin session expired. Please sign in again.' })
  }
}

function requirePermission(permission) {
  return (req, res, next) => {
    const granted = roles[req.admin?.role]
    if (!granted || (!granted.has('*') && !granted.has(permission))) return res.status(403).json({ success: false, message: 'You do not have permission to perform this action.' })
    next()
  }
}

async function requireCommunity(req, res, next) {
  const communityId = req.get('x-community-id') || req.params.communityId || req.params.id || req.query.communityId || req.body?.communityId
  if (!mongoose.isValidObjectId(communityId)) return res.status(400).json({ success: false, message: 'Select a community to continue.' })
  try {
    const community = await Community.findOne({ _id: communityId, status: 'ACTIVE' }).lean()
    if (!community) return res.status(404).json({ success: false, message: 'Community not found or inactive.' })
    if (req.admin.role !== 'SUPER_ADMIN' && !(req.admin.communityIds || []).some(id => String(id) === String(community._id))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this community.' })
    }
    req.community = community
    req.communityId = community._id
    next()
  } catch (error) { next(error) }
}

module.exports = { authenticateAdmin, requirePermission, requireCommunity }
