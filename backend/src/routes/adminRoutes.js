const router = require('express').Router()
const admin = require('../controllers/adminController')
const auth = require('../middleware/authMiddleware')
router.post('/login', admin.login)
router.get('/me', auth, admin.me)
router.get('/users', auth, require('../middleware/adminAccess').requirePermission('users:manage'), admin.listUsers)
router.post('/users', auth, require('../middleware/adminAccess').requirePermission('users:manage'), admin.createUser)
router.patch('/users/:id', auth, require('../middleware/adminAccess').requirePermission('users:manage'), admin.updateUser)
module.exports = router
