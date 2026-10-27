const { createTenantProxy } = require('../utils/tenantContext');
const mongoose = require('mongoose');

const appealSchema = new mongoose.Schema({
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
  help_type: {
    type: String,
    enum: ['Medical', 'Financial', 'Emergency', 'Other'],
    default: 'Medical',
    index: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  required_help: {
    type: String,
    required: true,
    trim: true
  },
  required_amount: {
    type: Number,
    default: 0
  },
  collected_amount: {
    type: Number,
    default: 0
  },
  images: [{
    type: String
  }],
  documents: [{
    name: { type: String, default: '' },
    url: { type: String, required: true },
    type: { type: String, default: '' }
  }],
  // Contact information
  contact_name: {
    type: String,
    required: true,
    trim: true
  },
  contact_phone: {
    type: String,
    required: true,
    trim: true
  },
  contact_alt_phone: {
    type: String,
    default: '',
    trim: true
  },
  contact_city: {
    type: String,
    default: '',
    trim: true
  },
  contact_address: {
    type: String,
    default: '',
    trim: true
  },
  // Medical / Patient specifics (applicable when Medical)
  patient_name: {
    type: String,
    default: '',
    trim: true
  },
  hospital_name: {
    type: String,
    default: '',
    trim: true
  },
  // Bank / Financial details for direct aid
  bank_name: {
    type: String,
    default: '',
    trim: true
  },
  account_holder_name: {
    type: String,
    default: '',
    trim: true
  },
  account_number: {
    type: String,
    default: '',
    trim: true
  },
  ifsc_code: {
    type: String,
    default: '',
    trim: true
  },
  upi_id: {
    type: String,
    default: '',
    trim: true
  },
  qr_code_image: {
    type: String,
    default: ''
  },
  // Status workflow: Pending -> Approved / Rejected -> Completed
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected', 'Completed'],
    default: 'Pending',
    index: true
  },
  admin_notes: {
    type: String,
    default: ''
  },
  rejection_reason: {
    type: String,
    default: ''
  },
  approved_at: {
    type: Date,
    default: null
  },
  approved_by: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, default: '' }
  },
  completed_at: {
    type: Date,
    default: null
  },
  // Creator / Submitter Info
  created_by: {
    id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    name: { type: String, default: '' },
    phone: { type: String, default: '' },
    member_id: { type: String, default: '' }
  },
  member_id: {
    type: String,
    index: true
  },
  // History of notifications broadcasted for this appeal
  notifications_sent: [
    {
      title: { type: String, required: true },
      message: { type: String, required: true },
      instructions: { type: String, default: '' },
      target_type: { type: String, enum: ['all', 'specific'], default: 'all' },
      recipient_count: { type: Number, default: 0 },
      target_user_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      sent_at: { type: Date, default: Date.now },
      sent_by: {
        id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        name: { type: String, default: '' }
      }
    }
  ],
  cdate: {
    type: String,
    default: ''
  }
}, {
  timestamps: true,
  strict: false,
  id: false
});

module.exports = createTenantProxy('Appeal', appealSchema);
