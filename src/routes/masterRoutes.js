const express = require('express');
const adminContent = require('../controllers/adminContentController');
const { protect, requirePermission } = require('../middleware/auth');
const { parseForm } = require('../middleware/upload');

const router = express.Router();

const masterPermission = (action) => (req) => `${req.params.type === 'business' ? 'businesses' : req.params.type}.${action}`;

router.get('/:type', adminContent.getMasters);
router.get('/:type/:id', adminContent.getMasterById);
router.post('/:type', protect, requirePermission(masterPermission('add')), parseForm, adminContent.saveMaster);
router.put('/:type/:id', protect, requirePermission(masterPermission('edit')), parseForm, adminContent.saveMaster);
router.delete('/:type/:id', protect, requirePermission(masterPermission('delete')), adminContent.deleteMaster);

module.exports = router;
