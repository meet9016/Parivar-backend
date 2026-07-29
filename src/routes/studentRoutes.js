const express = require('express');
const { protect, requirePermission, getTokenFromRequest } = require('../middleware/auth');
const { parseForm } = require('../middleware/upload');
const { getStudents, addStudent, updateStudent, deleteStudent } = require('../controllers/studentController');

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

router.get('/', optionalProtect, getStudents);

router.post('/', protect, parseForm, (req, res, next) => {
    if (isAdminCall(req)) {
        return requirePermission('students.add')(req, res, () => addStudent(req, res, next));
    }
    return addStudent(req, res, next);
});

router.put('/:id', protect, parseForm, (req, res, next) => {
    if (isAdminCall(req)) {
        return requirePermission('students.edit')(req, res, () => updateStudent(req, res, next));
    }
    return updateStudent(req, res, next);
});

router.delete('/:id', protect, (req, res, next) => {
    if (isAdminCall(req)) {
        return requirePermission('students.delete')(req, res, () => deleteStudent(req, res, next));
    }
    return deleteStudent(req, res, next);
});

module.exports = router;
