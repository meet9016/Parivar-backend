const mongoose = require('mongoose');

const newsSchema = new mongoose.Schema({
  id: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: false
  },
  category: {
    type: String,
    required: false
  },
  image: {
    type: String,
    default: ''
  },
  reporter_name: {
    type: String,
    required: true
  },
  location: {
    type: String,
    required: true
  }
}, {
  timestamps: true,
  strict: false
});

module.exports = mongoose.model('News', newsSchema);
