const express = require('express');
const {
  getEventsList,
  getEventById,
  addEvent,
  updateEvent,
  deleteEvent,
  bulkUpdateEventStatus,
  bulkDeleteEvents
} = require('../controllers/eventController');
const { protect, requirePermission } = require('../middleware/auth');
const { postUpload } = require('../middleware/upload');

const router = express.Router();

const isAdminCall = (req) => {
  return req.user && (req.user.is_committee || req.user.role_id || req.user.role === 'admin');
};

router.get('/',   getEventsList);
router.get('/:id', getEventById);

router.post('/', protect, postUpload, (req, res, next) => {
  if (isAdminCall(req)) {
    return requirePermission('events.add')(req, res, () => addEvent(req, res, next));
  }
  return addEvent(req, res, next);
});

router.put('/bulk/status', protect, requirePermission('events.edit'), bulkUpdateEventStatus);
router.post('/bulk/delete', protect, requirePermission('events.delete'), bulkDeleteEvents);
router.delete('/bulk', protect, requirePermission('events.delete'), bulkDeleteEvents); // for compatibility

router.put('/:id', protect, postUpload, (req, res, next) => {
  if (isAdminCall(req)) {
    return requirePermission('events.edit')(req, res, () => updateEvent(req, res, next));
  }
  return updateEvent(req, res, next);
});

router.delete('/:id', protect, (req, res, next) => {
  if (isAdminCall(req)) {
    return requirePermission('events.delete')(req, res, () => deleteEvent(req, res, next));
  }
  return deleteEvent(req, res, next);
});

module.exports = router;
