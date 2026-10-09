const { createTenantProxy } = require('../utils/tenantContext');
const mongoose = require('mongoose');

const pollVoteSchema = new mongoose.Schema({
  pollId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Poll',
    required: true,
    index: true
  },
  memberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  selectedOptions: [{
    type: mongoose.Schema.Types.ObjectId,
    required: true
  }]
}, {
  timestamps: true
});

// Guarantee a member can only have one vote record per poll
pollVoteSchema.index({ pollId: 1, memberId: 1 }, { unique: true });

module.exports = createTenantProxy('PollVote', pollVoteSchema);
