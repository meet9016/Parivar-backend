const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  date: {
    type: String,
    required: true,
    trim: true
  },
  expense_category_id: {
    type: String,
    default: '',
    trim: true
  },
  expense_category_name: {
    type: String,
    default: '',
    trim: true
  },
  committee_member_id: {
    type: String,
    default: '',
    trim: true
  },
  committee_member_name: {
    type: String,
    default: '',
    trim: true
  },
  amount: {
    type: Number,
    required: true,
    default: 0
  },
  description: {
    type: String,
    default: '',
    trim: true
  },
  image: {
    type: String,
    default: ''
  }
}, {
  timestamps: true,
  strict: false
});

module.exports = mongoose.model('Expense', expenseSchema);
