const express = require('express')
const controller = require('../controllers/masterDataController')
const router = express.Router()
const choices = require('../controllers/locationChoiceController')
const { authenticateAdmin, requirePermission, requireCommunity } = require('../middleware/adminAccess')
router.get('/states', (req, res) => { const items = require('../config/states'); res.json({ success: true, data: { items, pagination: { page: 1, limit: 100, total: items.length, pages: 1 } } }) })
router.get('/location-choices', choices.list)
router.get('/managed-locations', authenticateAdmin, requirePermission('community:read'), requireCommunity, choices.manage)
router.post('/managed-locations', authenticateAdmin, requirePermission('community:update'), requireCommunity, choices.create)
router.patch('/managed-locations/:choiceId', authenticateAdmin, requirePermission('community:update'), requireCommunity, choices.update)
const endpoints = [
  ['/districts', controller.districts],
  ['/blocks', controller.blocks],
  ['/village-panchayats', controller.villages],
  ['/habitations', controller.habitations],
  ['/assembly-constituencies', controller.assemblies],
  ['/post-offices', controller.postOffices],
  ['/pincodes', controller.pincodes],
]
for (const [route, handler] of endpoints) router.get(route, handler)
router.masterDataGetRoutes = endpoints.map(([route]) => `GET /api/master${route}`)
module.exports = router
