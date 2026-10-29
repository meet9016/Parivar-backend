const express = require('express');
const { protect, optionalProtect, requirePermission, getTokenFromRequest } = require('../middleware/auth');
const { parseForm } = require('../middleware/upload');
const { 
    getBusinesses, 
    getBusinessById, 
    addBusinessDetails, 
    deleteBusiness, 
    getBusinessCategoryList,
    exportBusinesses,
    downloadExportedBusinesses
} = require('../controllers/businessController');

const router = express.Router();

router.get('/', optionalProtect, getBusinesses);
router.get('/export', protect, exportBusinesses);
router.get('/export/download/:filename', downloadExportedBusinesses);
router.get('/:id', optionalProtect, getBusinessById);
router.post('/', protect, requirePermission('businesses.add'), parseForm, addBusinessDetails);
router.put('/:id', protect, requirePermission('businesses.edit'), parseForm, addBusinessDetails);
router.delete('/:id', protect, requirePermission('businesses.delete'), deleteBusiness);

module.exports = router;
