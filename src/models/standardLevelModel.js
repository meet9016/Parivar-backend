const { createTenantProxy } = require('../utils/tenantContext');
const mongoose = require('mongoose');

const standardLevelSchema = new mongoose.Schema({
  id: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  level: {
    type: String,
    required: true,
    enum: [
      'Standard / School Level',
      'Graduation (Bachelor Degree)',
      'Post Graduation (Master Degree)'
    ],
    index: true
  },
  name: {
    type: String,
    required: true,
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

module.exports = createTenantProxy('StandardLevel', standardLevelSchema);
