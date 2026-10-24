const { createTenantProxy } = require('../utils/tenantContext');
const mongoose = require('mongoose');

const educationSchema = new mongoose.Schema({
  id: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  level: {
    type: String,
    required: true,
    trim: true,
    enum: ['School', 'Bachelor', 'Master', 'Diploma', 'Other'],
    default: 'School',
    index: true
  },
  standard: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  name: {
    type: String,
    trim: true,
    index: true
  },
  description: {
    type: String,
    default: '',
    trim: true
  },
  status: {
    type: Number,
    default: 1,
    index: true
  }
}, {
  timestamps: true,
  strict: false,
  id: false
});

module.exports = createTenantProxy('Education', educationSchema);
