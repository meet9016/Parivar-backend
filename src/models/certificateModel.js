const mongoose = require('mongoose');
const { createTenantProxy } = require('../utils/tenantContext');

const certificateSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['marriage', 'letterhead', 'noc'],
    default: 'marriage',
    index: true,
  },
  certificateNumber: {
    type: String,
    trim: true,
    default: '',
    index: true,
  },
  title: {
    type: String,
    default: '',
  },
  issuedDate: {
    type: String,
    default: '',
  },
  primaryName: {
    type: String,
    default: '',
  },
  secondaryName: {
    type: String,
    default: '',
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  templateConfig: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  }
}, {
  timestamps: true,
  strict: false,
});

module.exports = createTenantProxy('Certificate', certificateSchema);

