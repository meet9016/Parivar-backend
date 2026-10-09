const { createTenantProxy } = require('../utils/tenantContext');
const mongoose = require('mongoose');

const pollOptionSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true
  }
});

const pollSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  options: {
    type: [pollOptionSchema],
    validate: {
      validator: function (opts) {
        return Array.isArray(opts) && opts.length >= 2;
      },
      message: 'Poll must have at least 2 options'
    }
  },
  type: {
    type: String,
    enum: ['single', 'multiple'],
    default: 'single'
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'closed', 'expired'],
    default: 'active',
    index: true
  },
  createdBy: {
    id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    name: {
      type: String,
      default: ''
    }
  },
  startDate: {
    type: Date,
    default: null
  },
  endDate: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  strict: false
});

module.exports = createTenantProxy('Poll', pollSchema);
