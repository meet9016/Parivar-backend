const mongoose = require('mongoose');

const contactInquirySchema = new mongoose.Schema({
  id: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  name: {
    type: String,
    default: '',
    trim: true
  },
  email: {
    type: String,
    default: '',
    trim: true
  },
  phone: {
    type: String,
    default: '',
    trim: true
  },
  subject: {
    type: String,
    default: '',
    trim: true
  },
  message: {
    type: String,
    default: '',
    trim: true
  },
  status: {
    type: String,
    default: 'new',
    index: true
  }
}, {
  timestamps: true,
  strict: false
});

module.exports = mongoose.model('ContactInquiry', contactInquirySchema);
