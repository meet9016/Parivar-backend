const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
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
  image: {
    type: String,
    default: ''
  },

  event_category_id: {
    type: String,
    default: ''
  },
  event_category_name: {
    type: String,
    default: ''
  },
  event_name: {
    type: String,
    default: ''
  },
  event_location: {
    type: String,
    default: ''
  },
  country_id: {
    type: String,
    default: ''
  },
  state_id: {
    type: String,
    default: ''
  },
  city_id: {
    type: String,
    default: ''
  },
  country: {
    type: String,
    default: ''
  },
  state: {
    type: String,
    default: ''
  },
  city: {
    type: String,
    default: ''
  },
  location_link: {
    type: String,
    default: ''
  },
  start_time: {
    type: Date
  },
  end_time: {
    type: Date
  },
  entry_type: {
    type: String,
    default: ''
  },
  status: {
    type: Number,
    default: 1,
    index: true
  },
  created_by: {
    id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    name: { type: String, default: '' }
  }

}, {
  timestamps: true,
  strict: false
});

module.exports = mongoose.model('Event', eventSchema);
