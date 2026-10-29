const express = require('express');
const { 
    getMatrimonies, 
    getMatrimonyById, 
    addMatrimony, 
    updateMatrimony, 
    deleteMatrimony,
    exportMatrimonies,
    downloadExportedMatrimonies
} = require('../controllers/matrimonyController');
const { protect, optionalProtect, requirePermission, getTokenFromRequest } = require('../middleware/auth');
const { parseForm } = require('../middleware/upload');

const router = express.Router();

const isAdminCall = (req) => {
    return req.user && (req.user.is_committee || req.user.role_id || req.user.role === 'admin');
};

router.get('/', optionalProtect, getMatrimonies);
router.get('/export', protect, exportMatrimonies);
router.get('/export/download/:filename', downloadExportedMatrimonies);

router.get('/:id', optionalProtect, getMatrimonyById);

router.post('/', protect, parseForm, (req, res, next) => {
    if (isAdminCall(req)) {
        return requirePermission('matrimonies.add')(req, res, () => addMatrimony(req, res, next));
    }
    return addMatrimony(req, res, next);
});

router.put('/:id', protect, parseForm, (req, res, next) => {
    if (isAdminCall(req)) {
        return requirePermission('matrimonies.edit')(req, res, () => updateMatrimony(req, res, next));
    }
    return updateMatrimony(req, res, next);
});

router.delete('/:id', protect, (req, res, next) => {
    if (isAdminCall(req)) {
        return requirePermission('matrimonies.delete')(req, res, () => deleteMatrimony(req, res, next));
    }
    return deleteMatrimony(req, res, next);
});

module.exports = router;
