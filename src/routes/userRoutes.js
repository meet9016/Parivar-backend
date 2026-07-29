const express = require('express');
const userController = require('../controllers/userController');
const { authorizeUserUpdate, protect, requirePermission, getTokenFromRequest } = require('../middleware/auth');
const { parseForm } = require('../middleware/upload');
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

router.post('/fcm-token', protect, async (req, res) => {
    try {
        const token = req.body.fcm_token || req.query.fcm_token;
        if (!token) return apiResponse(res, 400, 'FCM token required');
        await User.findByIdAndUpdate(req.user._id || req.user.id, { fcm_token: token });
        return apiResponse(res, 200, 'FCM token saved');
    } catch (e) {
        return apiResponse(res, 500, 'Error saving FCM token');
    }
});

router.get('/', protect, userController.getUsers);

router.get('/family/:family_head_id', protect, userController.getFamilyMembers);

router.get('/:id', protect, (req, res, next) => {
    return userController.getUserById(req, res, next);
});

router.put('/:id', protect, parseForm, (req, res, next) => {
    if (isAdminCall(req)) {
        return requirePermission('members.edit')(req, res, () => userController.updateUser(req, res, next));
    }
    return authorizeUserUpdate(req, res, () => userController.updateUser(req, res, next));
});

router.delete('/:id', protect, requirePermission('members.delete'), userController.deleteUser);

module.exports = router;
