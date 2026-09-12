const { createTenantProxy } = require('../utils/tenantContext');
const mongoose = require('mongoose');

const mandalSchema = new mongoose.Schema({
  name: {
    type: String,
    default: 'Mandal',
    trim: true
  },
  monthly_amount: {
    type: Number,
    default: 500,
    min: 0
  },
  start_date: {
    type: Date,
    default: Date.now
  },
  mandal_head_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  mandal_head_name: {
    type: String,
    default: '',
    trim: true
  },
  status: {
    type: Number,
    default: 1 // 1 = Active, 0 = Inactive
  },
  description: {
    type: String,
    default: '',
    trim: true
  },
  rules: {
    type: String,
    default: '',
    trim: true
  },
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true,
  strict: false,
  id: false
});

module.exports = createTenantProxy('Mandal', mandalSchema);
