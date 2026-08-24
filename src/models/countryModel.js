const mongoose = require('mongoose');

const countrySchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.Mixed,
    default: () => new mongoose.Types.ObjectId()
  },

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
  strict: false, id: false
});

module.exports = mongoose.model('Country', countrySchema);
