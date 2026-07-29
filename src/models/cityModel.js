const mongoose = require('mongoose');

const citySchema = new mongoose.Schema({
  id: {
    type: String,
    unique: true,
    sparse: true
  },
  state_id: {
    type: String,
    required: true,
    index: true
  },
  name: {
    type: String,
    default: '',
    trim: true
  },
  city: {
    type: String,
    default: ''
  }
}, {
  timestamps: true,
  strict: false
});

module.exports = mongoose.model('City', citySchema);
