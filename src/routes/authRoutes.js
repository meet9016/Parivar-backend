const express = require('express');
// const { login } = require('../controllers/adminController');
const { parseForm } = require('../middleware/upload');
const { login } = require('../controllers/authController');

const { protect, getRolePermissions } = require('../middleware/auth');

const router = express.Router();

router.post('/', parseForm, login);

router.get('/me', protect, (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ status: 401, message: 'Unauthorized' });
  const permissions = getRolePermissions(user);
  const isSuperAdmin = user.role === 'superadmin' || user.committee_role === 'President' || user.role_id?.name?.toLowerCase() === 'admin' || user.role_id?.name?.toLowerCase() === 'super admin' || (!user.role_id && (user.role === 'admin' || user.committee_role === 'Admin'));

  const userData = {
    id: user.id || String(user._id),
    name: user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim(),
    email: user.email,
    role: isSuperAdmin ? 'admin' : (user.is_committee ? 'committee' : 'user'),
    is_committee: Boolean(user.is_committee),
    committee_role: user.committee_role || user.designation || '',
    role_id: user.role_id?._id ? String(user.role_id._id) : (user.role_id || ''),
    role_name: user.role_id?.name || '',
    permissions,
    is_super_admin: isSuperAdmin
  };

  return res.status(200).json({ status: 200, message: 'Profile fetched', data: userData });
});

router.post('/logout', protect, async (req, res) => {
  try {
    const User = require('../models/userModels');
    if (req.user && (req.user._id || req.user.id)) {
      const targetId = req.user._id || req.user.id;
      const UserModel = req.tenantConn?.models?.User || User;
      await UserModel.findByIdAndUpdate(targetId, { session_id: null });
    }
    return res.status(200).json({ status: 200, message: 'Logged out successfully' });
  } catch (err) {
    return res.status(200).json({ status: 200, message: 'Logged out successfully' });
  }
});

module.exports = router;
