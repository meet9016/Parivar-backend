const { createTenantProxy } = require('../utils/tenantContext');
const mongoose = require('mongoose');

const mandalContributionSchema = new mongoose.Schema({
  mandal_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mandal',
    required: true,
    index: true
  },
  member_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  member_name: {
    type: String,
    default: '',
    trim: true
  },
  member_number: {
    type: String,
    default: '',
    trim: true
  },
  month: {
    type: String, // Format: 'YYYY-MM', e.g., '2026-09'
    required: true,
    index: true
  },
  amount: {
    type: Number,
    default: 0,
    min: 0
  },
  expected_amount: {
    type: Number,
    default: 0,
    min: 0
  },
  payment_date: {
    type: Date,
    default: null
  },
  payment_mode: {
    type: String,
    enum: ['Cash', 'Bank', 'Transfer', 'Online', 'Cheque', 'UPI', 'Other'],
    default: 'Cash'
  },
  status: {
    type: String,
    enum: ['Paid', 'Pending', 'Partial'],
    default: 'Pending',
    index: true
  },
  transaction_id: {
    type: String,
    default: '',
    trim: true
  },
  receipt_number: {
    type: String,
    default: '',
    trim: true
  },
  notes: {
    type: String,
    default: '',
    trim: true
  },
  collected_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true,
  strict: false,
  id: false
});

// Compound index to ensure uniqueness of contribution record per member per month
mandalContributionSchema.index({ mandal_id: 1, member_id: 1, month: 1 }, { unique: true });

module.exports = createTenantProxy('MandalContribution', mandalContributionSchema);
