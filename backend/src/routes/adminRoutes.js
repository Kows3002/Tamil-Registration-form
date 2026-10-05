const router = require('express').Router()
const admin = require('../controllers/adminController')
const auth = require('../middleware/authMiddleware')
router.post('/login', admin.login)
router.get('/me', auth, admin.me)
module.exports = router
