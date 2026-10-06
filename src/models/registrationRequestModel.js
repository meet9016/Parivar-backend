const mongoose = require('mongoose');
const { createTenantProxy } = require('../utils/tenantContext');

const registrationRequestSchema = new mongoose.Schema({
  number: {
    type: String,
    required: [true, 'Primary phone number is required'],
    trim: true,
    index: true
  },
  // Key status flag
  status: {
    type: String,
    enum: ['pending_review', 'in_progress', 'approved', 'rejected', 'needs_correction'],
    default: 'in_progress',
    index: true
  },
  is_approved: {
    type: Boolean,
    default: false,
    index: true
  },
  current_step: {
    type: Number,
    default: 1
  },

  // Step-wise dynamic data storage (Stores all fields received for each step)
  step1: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({})
  },
  step2: {
    type: [mongoose.Schema.Types.Mixed],
    default: () => []
  },
  step3: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({})
  },
  step4: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({})
  },
  step5: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({})
  },

  // Flattened convenient fields for quick searching/indexing in admin table
  first_name: { type: String, default: '', trim: true },
  middle_name: { type: String, default: '', trim: true },
  last_name: { type: String, default: '', trim: true },
  father_husband_name: { type: String, default: '', trim: true },
  gender: { type: String, default: '' },
  dob: { type: Date },
  anniversary: { type: Date },
  blood_group: { type: String, default: '' },
  marital_status: { type: String, default: '' },
  patti_para_pargana: { type: String, default: '' },
  peta_jati: { type: String, default: '' },
  email: { type: String, default: '', trim: true },
  profile_image: { type: String, default: '' },

  country_id: { type: String, default: '' },
  state_id: { type: String, default: '' },
  district_id: { type: String, default: '' },
  taluka_id: { type: String, default: '' },
  city_id: { type: String, default: '' },
  village_id: { type: String, default: '' },
  village: { type: String, default: '' },
  address: { type: String, default: '' },
  pincode: { type: String, default: '' },
  occupation: { type: String, default: '' },
  occupation_type: { type: String, default: '' },
  occupation_details: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  documents: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },

  // Linked User ID once approved & created in User table
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  member_id: {
    type: String,
    default: ''
  },

  rejection_reason: {
    type: String,
    default: ''
  },
  correction_remarks: {
    type: String,
    default: ''
  },
  fields_to_correct: {
    type: [String],
    default: () => []
  },
  approved_at: {
    type: Date,
    default: null
  },
  approved_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true,
  strict: false
});

module.exports = createTenantProxy('RegistrationRequest', registrationRequestSchema);
