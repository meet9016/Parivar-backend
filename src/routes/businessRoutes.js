const express = require('express');

const { protect, requirePermission, getTokenFromRequest } = require('../middleware/auth');
const { parseForm } = require('../middleware/upload');
const { getBusinesses,getBusinessById, addBusinessDetails ,deleteBusiness, getBusinessCategoryList } = require('../controllers/businessController');

const router = express.Router();

const optionalProtect = async (req, res, next) => {
    const token = getTokenFromRequest(req);
    if (token) {
        return protect(req, res, next);
    }
    return next();
};

router.get('/', optionalProtect, getBusinesses);
router.get('/:id', optionalProtect, getBusinessById);
router.post('/', protect, requirePermission('businesses.add'), parseForm, addBusinessDetails);
router.put('/:id', protect, requirePermission('businesses.edit'), parseForm, addBusinessDetails);
router.delete('/:id', protect, requirePermission('businesses.delete'), deleteBusiness);

module.exports = router;
