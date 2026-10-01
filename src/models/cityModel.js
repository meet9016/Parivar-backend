const { createTenantProxy } = require('../utils/tenantContext');
const mongoose = require('mongoose');

const citySchema = new mongoose.Schema({
  id: {
    type: String,
    unique: true,
    sparse: true
  },
  district_id: {
    type: String,
    required: false,
    default: '',
    index: true
  },
  state_id: {
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
  city: {
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

module.exports = createTenantProxy('City', citySchema);
