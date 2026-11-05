const mongoose = require('mongoose');
const { createTenantProxy } = require('../utils/tenantContext');

const suvicharSchema = new mongoose.Schema({
  id: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  title: {
    type: String,
    trim: true,
    default: ''
  },
  suvichar: {
    type: String,
    trim: true,
    default: ''
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  author: {
    type: String,
    trim: true,
    default: ''
  },
  image: {
    type: String,
    default: ''
  },
  date: {
    type: Date,
    default: Date.now
  },
  var: {
    type: String,
    trim: true,
    default: ''
  },
  vaar: {
    type: String,
    trim: true,
    default: ''
  },
  status: {
    type: Number,
    default: 1,
    index: true
  },
  notification_sent: {
    type: Boolean,
    default: false
  },
  reminder_sent: {
    type: Boolean,
    default: false
  },
  notified_date: {
    type: String,
    default: null
  },
  send_notification: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  strict: false,
  id: false
});

module.exports = createTenantProxy('Suvichar', suvicharSchema);
