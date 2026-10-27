const express = require('express');
const {
  getAppeals,
  getMyAppeals,
  getStats,
  getAppealById,
  createAppeal,
  updateAppeal,
  updateStatus,
  sendNotification,
  getNotificationHistory,
  deleteAppeal
} = require('../controllers/appealController');
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
  return req.user && (
    req.user.is_committee ||
    req.user.role_id ||
    req.user.role === 'admin' ||
    req.user.role === 'superadmin' ||
    req.user.committee_role === 'President' ||
    req.user.committee_role === 'Admin'
  );
};

// Overview Statistics for Dashboard
router.get('/stats', protect, (req, res, next) => {
  if (isAdminCall(req)) {
    return requirePermission('appeals.list')(req, res, () => getStats(req, res, next));
  }
  return getStats(req, res, next);
});

// Member's own submissions
router.get('/my', protect, getMyAppeals);

// List Appeals (Supports public, member own, and admin all)
router.get('/', optionalProtect, getAppeals);

// Single Appeal Details
router.get('/:id', optionalProtect, getAppealById);

// Submit new Appeal / Help Request
router.post('/', optionalProtect, parseForm, createAppeal);

// Update Appeal Details
router.put('/:id', protect, parseForm, (req, res, next) => {
  if (isAdminCall(req)) {
    return requirePermission('appeals.edit')(req, res, () => updateAppeal(req, res, next));
  }
  return updateAppeal(req, res, next);
});

// Admin updates status (Approve, Reject, Completed) - Support both PUT and PATCH
const handleStatusUpdate = (req, res, next) => {
  if (isAdminCall(req)) {
    return requirePermission('appeals.edit')(req, res, () => updateStatus(req, res, next));
  }
  return updateStatus(req, res, next);
};

router.patch('/:id/status', protect, parseForm, handleStatusUpdate);
router.put('/:id/status', protect, parseForm, handleStatusUpdate);

// Admin broadcasts Push Notification (All or Specific members)
router.post('/:id/notify', protect, parseForm, (req, res, next) => {
  if (isAdminCall(req)) {
    return requirePermission('appeals.edit')(req, res, () => sendNotification(req, res, next));
  }
  return sendNotification(req, res, next);
});

// Notification history for appeal
router.get('/:id/notifications', protect, (req, res, next) => {
  if (isAdminCall(req)) {
    return requirePermission('appeals.list')(req, res, () => getNotificationHistory(req, res, next));
  }
  return getNotificationHistory(req, res, next);
});

// Delete Appeal
router.delete('/:id', protect, (req, res, next) => {
  if (isAdminCall(req)) {
    return requirePermission('appeals.delete')(req, res, () => deleteAppeal(req, res, next));
  }
  return deleteAppeal(req, res, next);
});

module.exports = router;
