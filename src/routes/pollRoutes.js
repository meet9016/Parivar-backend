const express = require('express');
const {
  createPoll,
  getPolls,
  getPollById,
  updatePoll,
  deletePoll,
  submitVote,
  getPollResults,
  getPollResponses
} = require('../controllers/pollController');
const { protect } = require('../middleware/auth');
const { parseForm } = require('../middleware/upload');

const router = express.Router();

// Poll Management & Listing
router.post('/', protect, parseForm, createPoll);
router.get('/', protect, getPolls);
router.get('/:id', protect, getPollById);
router.put('/:id', protect, parseForm, updatePoll);
router.delete('/:id', protect, deletePoll);

// Member Voting & Updates
router.post('/:id/vote', protect, parseForm, submitVote);
router.put('/:id/vote', protect, parseForm, submitVote);

// Results & Detailed Member Responses
router.get('/:id/results', protect, getPollResults);
router.get('/:id/responses', protect, getPollResponses);

module.exports = router;
