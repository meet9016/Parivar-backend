const mongoose = require('mongoose');

const bankDetailSchema = new mongoose.Schema({
  id: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  bank_name: {
    type: String,
    required: true,
    trim: true
  },
  account_name: {
    type: String,
    trim: true
  },
  account_number: {
    type: String,
    required: true,
    trim: true
  },
  ifsc_code: {
    type: String,
    required: true,
    trim: true
  },
  branch: {
    type: String,
    trim: true
  },
  upi_link: {
    type: String,
    trim: true,
    default: ''
  },
  qr_code: {
    type: String,
    trim: true,
    default: ''
  },
  status: {
    type: Number,
    default: 1,
    index: true
  },
  cdate: {
    type: String,
    default: ''
  }
}, {
  timestamps: true,
  strict: false
});

module.exports = mongoose.model('BankDetail', bankDetailSchema);
