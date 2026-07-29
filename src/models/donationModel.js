const mongoose = require('mongoose');

const donationSchema = new mongoose.Schema({
  id: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  donator_name: {
    type: String,
    required: true,
    trim: true
  },
  donate_amount: {
    type: Number,
    required: true
  },

  donation_purpose: {
    type: String,
    required: true,
    trim: true
  },
  date: {
    type: String,
    required: true
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

module.exports = mongoose.model('Donation', donationSchema);
