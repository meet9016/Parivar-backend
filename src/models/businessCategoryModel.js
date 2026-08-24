const mongoose = require('mongoose');

const businessCategorySchema = new mongoose.Schema({
  id: {
    type: String,
    unique: true,
    sparse: true
  },
  name: {
    type: String,
    default: '',
    trim: true
  },
   image: {
    type: String,
    default: '',
  },
  state_id: {
    type: String,
    default: '',
    index: true
  },
  business: {
    type: String,
    default: ''
  }
}, {
  timestamps: true,
  strict: false, id: false
});

module.exports = mongoose.model('BusinessCategory', businessCategorySchema);
