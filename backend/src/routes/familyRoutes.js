const router = require('express').Router()
const auth = require('../middleware/authMiddleware')
const family = require('../controllers/familyController')
router.post('/', family.createFamily)
router.get('/', auth, family.listFamilies)
router.get('/:id', auth, family.getFamily)
router.put('/:id', auth, family.updateFamily)
router.delete('/:id', auth, family.deleteFamily)
module.exports = router
