const express = require('express');
const multer = require('multer');
const suvicharController = require('../controllers/suvicharController');
const { protect, requirePermission, getTokenFromRequest } = require('../middleware/auth');
const { parseForm } = require('../middleware/upload');

const uploadMemory = multer({ storage: multer.memoryStorage() });
const router = express.Router();

const isAdminCall = (req) => {
  return req.user && (req.user.is_committee || req.user.role_id || req.user.role === 'admin' || req.user.role === 'superadmin');
};

// General list & date filter route (used by Frontend table & Mobile Application via ?date=YYYY-MM-DD)
router.get('/', suvicharController.getSuvichars);

// Bulk import route
router.post('/bulk-import', uploadMemory.single('file'), (req, res, next) => {
  const token = getTokenFromRequest(req);
  if (token) {
    return protect(req, res, () => {
      if (isAdminCall(req)) {
        return requirePermission('suvichar.add')(req, res, () => suvicharController.bulkImportSuvichars(req, res, next));
      }
      return suvicharController.bulkImportSuvichars(req, res, next);
    });
  }
  return suvicharController.bulkImportSuvichars(req, res, next);
});

// Duplicate routes
router.post('/bulk-duplicate', parseForm, (req, res, next) => {
  const token = getTokenFromRequest(req);
  if (token) {
    return protect(req, res, () => {
      if (isAdminCall(req)) {
        return requirePermission('suvichar.add')(req, res, () => suvicharController.bulkDuplicateSuvichars(req, res, next));
      }
      return suvicharController.bulkDuplicateSuvichars(req, res, next);
    });
  }
  return suvicharController.bulkDuplicateSuvichars(req, res, next);
});

// Bulk create routes
router.post('/bulk-create', parseForm, (req, res, next) => {
  const token = getTokenFromRequest(req);
  if (token) {
    return protect(req, res, () => {
      if (isAdminCall(req)) {
        return requirePermission('suvichar.add')(req, res, () => suvicharController.saveSuvichar(req, res, next));
      }
      return suvicharController.saveSuvichar(req, res, next);
    });
  }
  return suvicharController.saveSuvichar(req, res, next);
});

router.post('/:id/duplicate', parseForm, (req, res, next) => {
  const token = getTokenFromRequest(req);
  if (token) {
    return protect(req, res, () => {
      if (isAdminCall(req)) {
        return requirePermission('suvichar.add')(req, res, () => suvicharController.duplicateSuvichar(req, res, next));
      }
      return suvicharController.duplicateSuvichar(req, res, next);
    });
  }
  return suvicharController.duplicateSuvichar(req, res, next);
});

router.get('/:id', suvicharController.getSuvicharById);

router.post('/', parseForm, (req, res, next) => {
  const token = getTokenFromRequest(req);
  if (token) {
    return protect(req, res, () => {
      if (isAdminCall(req)) {
        return requirePermission('suvichar.add')(req, res, () => suvicharController.saveSuvichar(req, res, next));
      }
      return suvicharController.saveSuvichar(req, res, next);
    });
  }
  return suvicharController.saveSuvichar(req, res, next);
});

router.put('/:id', protect, parseForm, (req, res, next) => {
  if (isAdminCall(req)) {
    return requirePermission('suvichar.edit')(req, res, () => suvicharController.saveSuvichar(req, res, next));
  }
  return res.status(403).json({ message: 'Forbidden' });
});

router.delete('/:id', protect, (req, res, next) => {
  if (isAdminCall(req)) {
    return requirePermission('suvichar.delete')(req, res, () => suvicharController.deleteSuvichar(req, res, next));
  }
  return res.status(403).json({ message: 'Forbidden' });
});

module.exports = router;
