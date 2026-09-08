const { createTenantProxy } = require('../utils/tenantContext');
const mongoose = require('mongoose');

const newsSchema = new mongoose.Schema({
  id: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: false
  },
  category: {
    type: String,
    required: false
  },
  image: {
    type: String,
    default: ''
  },
  reporter_name: {
    type: String,
    required: true
  },
  location: {
    type: String,
    required: true
  },
  status: {
    type: Number,
    default: 1
  },
  send_notification: {
    type: Boolean,
    default: true
  },
  target_type: {
    type: String,
    enum: ['all', 'committee', 'specific'],
    default: 'all'
  },
  target_users: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  reminder_sent: {
    type: Boolean,
    default: false,
    index: true
  }
}, {
  timestamps: true,
  strict: false, id: false
});

module.exports = createTenantProxy('News', newsSchema);
