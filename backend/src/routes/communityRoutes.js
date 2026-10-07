const router = require('express').Router()
const controller = require('../controllers/communityController')
const { authenticateAdmin, requirePermission, requireCommunity } = require('../middleware/adminAccess')

router.get('/public/:slug', controller.publicBySlug)
router.get('/', authenticateAdmin, controller.list)
router.post('/', authenticateAdmin, requirePermission('communities:manage'), controller.create)
router.patch('/:id', authenticateAdmin, requirePermission('communities:manage'), controller.update)
router.patch('/:communityId/profile', authenticateAdmin, requirePermission('community:update'), requireCommunity, controller.update)
router.get('/:communityId/forms', authenticateAdmin, requirePermission('forms:read'), requireCommunity, controller.getForm)
router.post('/:communityId/forms/drafts', authenticateAdmin, requirePermission('forms:write'), requireCommunity, controller.saveDraft)
router.post('/:communityId/forms/:versionId/publish', authenticateAdmin, requirePermission('forms:write'), requireCommunity, controller.publishForm)
module.exports = router
