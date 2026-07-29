const express = require('express');

const { protect, requirePermission } = require('../middleware/auth');
const { parseForm } = require('../middleware/upload');
const { getBusinesses,getBusinessById, addBusinessDetails ,deleteBusiness, getBusinessCategoryList } = require('../controllers/businessController');

const router = express.Router();

router.get('/', getBusinesses);
router.get('/:id', getBusinessById);
router.post('/', protect, requirePermission('businesses.add'), parseForm, addBusinessDetails);
router.put('/:id', protect, requirePermission('businesses.edit'), parseForm, addBusinessDetails);
router.delete('/:id', protect, requirePermission('businesses.delete'), deleteBusiness);

module.exports = router;
