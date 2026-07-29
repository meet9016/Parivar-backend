const express = require('express');

const { requirePermission, protect } = require('../middleware/auth');
const { getAllFeedback, getFeedbackById, addFeedback, deleteFeedback } = require('../controllers/feedbackController');
const { parseForm } = require('../middleware/upload');

const router = express.Router();

router.get('/', protect,parseForm, requirePermission('feedback.view'), getAllFeedback);
router.get('/:id', protect, parseForm, getFeedbackById);
router.post('/', protect, parseForm, addFeedback);
router.put('/:id', protect, parseForm, requirePermission('feedback.edit'), addFeedback);
router.delete('/:id', protect, parseForm, requirePermission('feedback.delete'), deleteFeedback);

module.exports = router;
