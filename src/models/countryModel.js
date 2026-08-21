const mongoose = require('mongoose');

const countrySchema = new mongoose.Schema({

  name: {
    type: String,
    default: '',
    trim: true
  },
  country: {
    type: String,
    default: ''
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

module.exports = mongoose.model('Country', countrySchema);
