const express = require('express')
const controller = require('../controllers/masterDataController')
const router = express.Router()
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
