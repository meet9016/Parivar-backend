const express = require('express');
const { protect, requirePermission } = require('../middleware/auth');
const { parseForm } = require('../middleware/upload');
const {
  getPolls,
  getPollById,
  createPoll,
  updatePoll,
  deletePoll,
  submitVote,
  getPollResults,
  getPollResponses
} = require('../controllers/pollController');

const router = express.Router();

// List & View
router.get('/', protect, requirePermission(['polls.list', 'polls.view', 'dashboard.view']), getPolls);
router.get('/:id', protect, requirePermission(['polls.list', 'polls.view']), getPollById);

// Manage Polls
router.post('/', protect, parseForm, requirePermission(['polls.add', 'polls.manage']), createPoll);
router.put('/:id', protect, parseForm, requirePermission(['polls.edit', 'polls.manage']), updatePoll);
router.delete('/:id', protect, requirePermission(['polls.delete', 'polls.manage']), deletePoll);

// Vote (Any authenticated member)
router.post('/:id/vote', protect, parseForm, submitVote);

// Results & Voter Responses
router.get('/:id/results', protect, requirePermission(['polls.list', 'polls.view']), getPollResults);
router.get('/:id/responses', protect, requirePermission(['polls.list', 'polls.view']), getPollResponses);

module.exports = router;
