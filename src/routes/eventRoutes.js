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

router.get('/',   getEventsList);
router.get('/:id', getEventById);
router.post('/', protect, requirePermission('events.add'), postUpload, addEvent);
router.put('/bulk/status', protect, requirePermission('events.edit'), bulkUpdateEventStatus);
router.post('/bulk/delete', protect, requirePermission('events.delete'), bulkDeleteEvents);
router.delete('/bulk', protect, requirePermission('events.delete'), bulkDeleteEvents); // for compatibility
router.put('/:id', protect, requirePermission('events.edit'), postUpload, updateEvent);
router.delete('/:id', protect, requirePermission('events.delete'), deleteEvent);

module.exports = router;
