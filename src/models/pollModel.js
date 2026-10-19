const { createTenantProxy } = require('../utils/tenantContext');
const mongoose = require('mongoose');

const pollOptionSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    default: () => `opt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
  },
  text: {
    type: String,
    required: true,
    trim: true
  },
  votes_count: {
    type: Number,
    default: 0
  }
}, { _id: false });

const pollSchema = new mongoose.Schema({
  id: {
    type: String,
    unique: true,
    sparse: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  poll_type: {
    type: String,
    enum: ['single', 'multiple'],
    default: 'single'
  },
  options: {
    type: [pollOptionSchema],
    validate: {
      validator: (v) => Array.isArray(v) && v.length >= 2,
      message: 'Poll must have at least 2 options'
    }
  },
  start_date: {
    type: Date,
    default: Date.now
  },
  end_date: {
    type: Date,
    default: null
  },
  status: {
    type: Number,
    default: 1 // 1 = Active, 0 = Inactive / Closed
  },
  is_anonymous: {
    type: Boolean,
    default: false
  },
  total_votes: {
    type: Number,
    default: 0
  },
  created_by: {
    id: { type: String, default: '' },
    name: { type: String, default: '' }
  }
}, { timestamps: true });

module.exports = createTenantProxy('Poll', pollSchema);
