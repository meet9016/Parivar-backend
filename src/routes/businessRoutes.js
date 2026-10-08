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

const isAdminCall = (req) => {
    return req.user && (req.user.is_committee || req.user.role_id || req.user.role === 'admin');
};

router.get('/', optionalProtect, getBusinesses);
router.get('/:id', optionalProtect, getBusinessById);

router.post('/', protect, parseForm, (req, res, next) => {
    if (isAdminCall(req)) {
        return requirePermission('businesses.add')(req, res, () => addBusinessDetails(req, res, next));
    }
    return addBusinessDetails(req, res, next);
});

router.put('/:id', protect, parseForm, (req, res, next) => {
    if (isAdminCall(req)) {
        return requirePermission('businesses.edit')(req, res, () => addBusinessDetails(req, res, next));
    }
    return addBusinessDetails(req, res, next);
});

router.delete('/:id', protect, (req, res, next) => {
    if (isAdminCall(req)) {
        return requirePermission('businesses.delete')(req, res, () => deleteBusiness(req, res, next));
    }
    return deleteBusiness(req, res, next);
});

module.exports = router;
