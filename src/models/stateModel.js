const mongoose = require('mongoose');

const stateSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.Mixed,
    default: () => new mongoose.Types.ObjectId()
  },

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

module.exports = mongoose.model('State', stateSchema);
