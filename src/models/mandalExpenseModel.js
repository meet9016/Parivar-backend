const { createTenantProxy } = require('../utils/tenantContext');
const mongoose = require('mongoose');

const mandalExpenseSchema = new mongoose.Schema({
  mandal_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mandal',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: [true, 'Expense title is required'],
    trim: true
  },
  category: {
    type: String,
    default: 'General',
    trim: true
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: 0
  },
  date: {
    type: Date,
    default: Date.now
  },
  description: {
    type: String,
    default: '',
    trim: true
  },
  receipt_image: {
    type: String,
    default: ''
  },
  payment_mode: {
    type: String,
    default: 'Cash'
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true,
  strict: false,
  id: false
});

module.exports = createTenantProxy('MandalExpense', mandalExpenseSchema);
