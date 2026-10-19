const { createTenantProxy } = require('../utils/tenantContext');
const mongoose = require('mongoose');

const pollVoteSchema = new mongoose.Schema({
  poll_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Poll',
    required: true,
    index: true
  },
  member_id: {
    type: String,
    required: true,
    index: true
  },
  member_name: {
    type: String,
    default: '',
    trim: true
  },
  member_mobile: {
    type: String,
    default: '',
    trim: true
  },
  selected_options: [{
    type: String,
    required: true
  }],
  voted_at: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

pollVoteSchema.index({ poll_id: 1, member_id: 1 }, { unique: true });

module.exports = createTenantProxy('PollVote', pollVoteSchema);
