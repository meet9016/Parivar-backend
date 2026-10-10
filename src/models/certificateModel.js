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
  },

  // ── Stored PDF Management Metadata ──
  pdfUrl: {
    type: String,
    default: '',
    trim: true,
  },
  pdfPath: {
    type: String,
    default: '',
    trim: true,
  },
  fileName: {
    type: String,
    default: '',
    trim: true,
  },
  fileSize: {
    type: Number,
    default: 0,
  },
  mimeType: {
    type: String,
    default: 'application/pdf',
  },
  storageProvider: {
    type: String,
    enum: ['local', 'external', 'cloud'],
    default: 'local',
  },
  generatedAt: {
    type: Date,
    default: null,
  },
  isGenerated: {
    type: Boolean,
    default: false,
    index: true,
  },

  // ── Recoverable Soft Deletion ──
  isDeleted: {
    type: Boolean,
    default: false,
    index: true,
  },
  deletedAt: {
    type: Date,
    default: null,
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  }
}, {
  timestamps: true,
  strict: false,
});

module.exports = createTenantProxy('Certificate', certificateSchema);

