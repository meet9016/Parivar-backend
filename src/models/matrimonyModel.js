const mongoose = require('mongoose');

const matrimonySchema = new mongoose.Schema({
  id: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  member_id: {
    type: String,
    index: true
  },
  full_name: {
    type: String,
    required: true,
    trim: true
  },
  gender: {
    type: String,
    required: true,
    trim: true
  },
  birthdate: {
    type: String,
    required: true,
    trim: true
  },
  marital_status: {
    type: String,
    required: true,
    trim: true
  },
  height: {
    type: String,
    required: true,
    trim: true
  },
  weight: {
    type: String,
    required: true,
    trim: true
  },
  complexion: {
    type: String,
    required: true,
    trim: true
  },
  education: {
    type: String,
    required: true,
    trim: true
  },
  occupation: {
    type: String,
    required: true,
    trim: true
  },
  father_name: {
    type: String,
    required: true,
    trim: true
  },
  mother_name: {
    type: String,
    required: true,
    trim: true
  },
  gotra: {
    type: String,
    required: true,
    trim: true
  },
  family_type: {
    type: String,
    required: true,
    trim: true
  },
  mobile_number: {
    type: String,
    required: true,
    trim: true
  },
  city: {
    type: String,
    required: true,
    trim: true
  },
  about: {
    type: String,
    trim: true
  },
  biodata: {
    type: String,
    default: ''
  },
  person_image: {
    type: String,
    default: ''
  },
  status: {
    type: Number,
    default: 0,
    index: true
  },
  cdate: {
    type: String,
    default: ''
  }
}, {
  timestamps: true,
  strict: false
});

module.exports = mongoose.model('Matrimony', matrimonySchema);
