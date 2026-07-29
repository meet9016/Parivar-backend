const mongoose = require('mongoose');

const masterSchema = new mongoose.Schema({
  id: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  parent_id: {
    type: String,
    default: '',
    index: true
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

module.exports = mongoose.model('Master', masterSchema);
