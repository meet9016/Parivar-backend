const express = require('express');
const {
  adminGetDonations, adminSaveDonation, adminDeleteDonation, exportDonations,
  getDonations, addDonation, updateDonation, deleteDonation
} = require('../controllers/donationController');
const { protect, requirePermission, getTokenFromRequest } = require('../middleware/auth');
const { parseForm } = require('../middleware/upload');

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

router.get('/',  getDonations);

router.get('/export', protect, requirePermission('donations.list'), exportDonations);

router.post('/', protect, parseForm, (req, res, next) => {
    if (isAdminCall(req)) {
        return requirePermission('donations.add')(req, res, () => adminSaveDonation(req, res, next));
    }
    return addDonation(req, res, next);
});

router.put('/:id', protect, parseForm, (req, res, next) => {
    if (isAdminCall(req)) {
        return requirePermission('donations.edit')(req, res, () => adminSaveDonation(req, res, next));
    }
    return updateDonation(req, res, next);
});

router.delete('/:id', protect, (req, res, next) => {
    if (isAdminCall(req)) {
        return requirePermission('donations.delete')(req, res, () => adminDeleteDonation(req, res, next));
    }
    return deleteDonation(req, res, next);
});

module.exports = router;
