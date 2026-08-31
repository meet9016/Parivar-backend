const { createTenantProxy } = require('../utils/tenantContext');
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
  middle_name: {
    type: String,
    trim: true
  },
  gender: {
    type: String,
    trim: true
  },
  birthdate: {
    type: String,
    trim: true
  },
  marital_status: {
    type: String,
    trim: true
  },
  height: {
    type: String,
    trim: true
  },
  weight: {
    type: String,
    trim: true
  },
  complexion: {
    type: String,
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
    trim: true
  },
  family_type: {
    type: String,
    trim: true
  },
  mobile_number: {
    type: String,
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
  created_by: {
    id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    name: { type: String, default: '' }
  },
  cdate: {
    type: String,
    default: ''
  }
}, {
  timestamps: true,
  strict: false, id: false
});

module.exports = createTenantProxy('Matrimony', matrimonySchema);
