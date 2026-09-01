const express = require('express');
const router = express.Router();
const { loginAdmin, updateAdminRecovery, createAdmin, getAdmins, changePassword } = require('../controllers/adminController');
const { parseForm } = require('../middleware/upload');
const { protect } = require('../middleware/auth');

router.post('/register_admin', parseForm, createAdmin);
router.get('/register_admin', getAdmins);
router.get('/get_admins', getAdmins);
router.post('/admin_login', parseForm, loginAdmin);
router.put('/update_admin', parseForm, updateAdminRecovery);
router.post('/change-password', protect, parseForm, changePassword);

module.exports = router;
