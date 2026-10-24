const { createTenantProxy } = require('../utils/tenantContext');
const mongoose = require('mongoose');

const diniTalimSchema = new mongoose.Schema({
  id: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
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

module.exports = createTenantProxy('DiniTalim', diniTalimSchema);
