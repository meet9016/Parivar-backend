const express = require('express');
const adminContent = require('../controllers/adminContentController');
const { protect, requirePermission } = require('../middleware/auth');
const { parseForm } = require('../middleware/upload');

const router = express.Router();

const masterPermission = (action) => (req) => `masters.${action}`;

// Allow open creation for location & registration masters used during member registration without token
const publicRegisterMasterTypes = ['country', 'state', 'district', 'city', 'village', 'taluka', 'patti-para-pargana', 'area', 'sub-caste'];

const optionalProtectForMasterAdd = (req, res, next) => {
  const type = (req.params.type || '').toLowerCase();
  if (publicRegisterMasterTypes.includes(type)) {
    return next();
  }
  return protect(req, res, () => {
    return requirePermission(masterPermission('add'))(req, res, next);
  });
};

router.get('/:type', adminContent.getMasters);
router.get('/:type/:id', adminContent.getMasterById);
router.post('/:type', optionalProtectForMasterAdd, parseForm, adminContent.saveMaster);
router.put('/:type/:id', protect, requirePermission(masterPermission('edit')), parseForm, adminContent.saveMaster);
router.delete('/:type/:id', protect, requirePermission(masterPermission('delete')), adminContent.deleteMaster);

module.exports = router;
