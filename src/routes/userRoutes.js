const express = require('express');
const userController = require('../controllers/userController');
const { authorizeUserUpdate, protect, requirePermission, getTokenFromRequest } = require('../middleware/auth');
const { parseForm, upload } = require('../middleware/upload');
const User = require('../models/userModels');
const { apiResponse } = require('../utils/apiResponse');

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

// router.post('/', parseForm, (req, res, next) => {
//     const token = getTokenFromRequest(req);
//     if (token) {
//         return protect(req, res, () => {
//             if (isAdminCall(req)) {
//                 return requirePermission('members.add')(req, res, () => userController.register(req, res, next));
//             }
//             return userController.register(req, res, next);
//         });
//     } else {
//         return userController.register(req, res, next);
//     }
// });

router.post('/', parseForm, userController.register)

// router.post('/login', parseForm, userController.login);
router.get('/profile', protect, userController.getProfile);

const { logout } = require('../controllers/authController');

router.post('/logout', logout);
router.get('/logout', logout);

router.post('/fcm-token', protect, async (req, res) => {
    try {
        const token = req.body.fcm_token || req.query.fcm_token;
        if (!token) return apiResponse(res, 400, 'FCM token required');
        const UserModel = req.tenantConn?.models?.User || User;
        await UserModel.findByIdAndUpdate(req.user._id || req.user.id, { fcm_token: token });
        return apiResponse(res, 200, 'FCM token saved');
    } catch (e) {
        return apiResponse(res, 500, 'Error saving FCM token');
    }
});

router.delete('/fcm-token', protect, async (req, res) => {
    try {
        const UserModel = req.tenantConn?.models?.User || User;
        await UserModel.findByIdAndUpdate(req.user._id || req.user.id, { fcm_token: '' });
        return apiResponse(res, 200, 'FCM token removed');
    } catch (e) {
        return apiResponse(res, 500, 'Error removing FCM token');
    }
});

router.get('/', (req, res, next) => {
    if (req.query.familyHead === 'true') {
        return next();
    }
    return protect(req, res, next);
}, userController.getUsers);

router.get('/family/:family_head_id', protect, userController.getFamilyMembers);

router.get('/family-by-number/:number', protect, userController.getFamilyMembersByNumber);
router.get('/check-number/:number', userController.checkNumberAvailability);
router.get('/check-number', userController.checkNumberAvailability);

router.put('/bulk-update', protect, (req, res, next) => {
    if (isAdminCall(req)) {
        return requirePermission('members.edit')(req, res, () => userController.bulkUpdateUsers(req, res, next));
    }
    return userController.bulkUpdateUsers(req, res, next);
});

router.get('/export', protect, userController.exportUsers);
router.get('/export/download/:filename', optionalProtect, userController.downloadExportFile);

router.post('/bulk-import', protect, requirePermission('members.add'), upload.single('file'), userController.bulkImportUsers);

// Death / Vafat Card Download & Link Endpoints (for Mobile App & Web)
router.get('/death/:id/download', optionalProtect, userController.downloadDeathCard);
router.get('/death/:id/download-link', optionalProtect, userController.getDeathCardLink);
router.get('/vafat/:id/download', optionalProtect, userController.downloadDeathCard);
router.get('/vafat/:id/download-link', optionalProtect, userController.getDeathCardLink);

router.get('/:id', protect, (req, res, next) => {
    return userController.getUserById(req, res, next);
});

router.put('/:id', protect, parseForm, (req, res, next) => {
    // Check if this is an vafat / Deceased record update (e.g. from Mobile App)
    const isDeceasedUpdate = Boolean(
        req.body && (
            req.body.is_deceased !== undefined ||
            req.body.death_date !== undefined ||
            req.body.janaza_date !== undefined ||
            req.body.janaza_time !== undefined ||
            req.body.janaza_place !== undefined ||
            req.body.kabrastan !== undefined ||
            req.body.islamic_date !== undefined ||
            req.body.vaar !== undefined ||
            req.body.address !== undefined ||
            req.body.village !== undefined ||
            req.body.death_note !== undefined
        )
    );

    if (isDeceasedUpdate) {
        // Strip admin-controlled role fields for security
        ['role', 'role_id', 'permissions', 'is_committee', 'committee_role', 'status'].forEach((field) => {
            if (req.body && Object.prototype.hasOwnProperty.call(req.body, field)) {
                delete req.body[field];
            }
        });
        return userController.updateUser(req, res, next);
    }

    if (isAdminCall(req)) {
        return requirePermission(['members.edit', 'death.edit', 'death.delete'])(req, res, () => userController.updateUser(req, res, next));
    }
    return authorizeUserUpdate(req, res, () => userController.updateUser(req, res, next));
});

router.delete('/:id', protect, requirePermission(['members.delete', 'death.delete']), userController.deleteUser);

module.exports = router;
