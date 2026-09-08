const express = require('express');

const { requirePermission, protect } = require('../middleware/auth');
const { getAllFeedback, getFeedbackById, addFeedback, deleteFeedback } = require('../controllers/feedbackController');
const { parseForm } = require('../middleware/upload');

const router = express.Router();

router.get('/', protect, parseForm, requirePermission(['feedback.list', 'feedback.view']), getAllFeedback);
router.get('/:id', protect, parseForm, requirePermission(['feedback.list', 'feedback.view']), getFeedbackById);
router.post('/', protect, parseForm, addFeedback);
router.put('/:id', protect, parseForm, requirePermission(['feedback.edit', 'feedback.add']), addFeedback);
router.delete('/:id', protect, parseForm, requirePermission(['feedback.delete', 'feedback.edit']), deleteFeedback);

module.exports = router;
