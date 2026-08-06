const mongoose = require('mongoose');

const stateSchema = new mongoose.Schema({

  country_id: {
    type: String,
    required: false,
    default: '',
    index: true
  },
  name: {
    type: String,
    default: '',
    trim: true
  },
  state: {
    type: String,
    default: ''
  }
}, {
  timestamps: true,
  strict: false
});

module.exports = mongoose.model('State', stateSchema);
