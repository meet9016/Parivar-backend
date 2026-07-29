const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema({
  id: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  title: {
    type: String,
    default: '',
    trim: true
  },
  subtitle: {
    type: String,
    default: '',
    trim: true
  },
  image: {
    type: String,
    default: ''
  },
  link: {
    type: String,
    default: '',
    trim: true
  },
  status: {
    type: Number,
    default: 1,
    index: true
  }
}, {
  timestamps: true,
  strict: false
});

module.exports = mongoose.model('Banner', bannerSchema);
