const express = require('express');
const roleController = require('../controllers/roleController');
const { protect, requirePermission } = require('../middleware/auth');
const { parseForm } = require('../middleware/upload');

const router = express.Router();

router.get('/', protect, requirePermission('roles.list'), roleController.getRoles);
router.get('/permissions', protect, requirePermission('roles.list'), roleController.getPermissionOptions);
router.post('/', protect, requirePermission('roles.add'), parseForm, roleController.saveRole);
router.put('/:id', protect, requirePermission('roles.edit'), parseForm, roleController.saveRole);
router.delete('/:id', protect, requirePermission('roles.delete'), roleController.deleteRole);

module.exports = router;
