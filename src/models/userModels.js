const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  member_id: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  parent_member_id: {
    type: String, // Links to a primary member's member_id to represent family hierarchy
    default: null,
    index: true
  },
  first_name: {
    type: String,
    required: [true, 'First name is required'],
    trim: true
  },
  middle_name: {
    type: String,
    trim: true
  },
  last_name: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    default: "12345" // Fallback password
  },
  number: {
    type: String,
    required: [true, 'Primary phone number is required'],
    trim: true,
    index: true // Multiple members can share the same login phone number
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other', ''],
    default: ''
  },
  dob: {
    type: Date
  },
  anniversary: {
    type: Date
  },
  blood_group: {
    type: String,
    trim: true
  },

  is_committee: {
    type: Boolean,
    default: false,
    index: true
  },
  committee_role: {
    type: String,
    default: '',
    trim: true
  },
  role_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role',
    default: null,
    index: true
  },
  profile_image: {
    type: String,
    default: ''
  },
  country_id: {
    type: String,
    default: ''
  },
  state_id: {
    type: String,
    default: ''
  },
  city_id: {
    type: String,
    default: ''
  },
  address: {
    type: String,
    default: '',
    trim: true
  },
  family_head: {
    id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    name: { type: String, default: '' }
  },
  relation: {
    type: String,
    default: 'Self', // 'Self', 'Father', 'Mother', 'Spouse', 'Son', 'Daughter', 'Brother', 'Sister', etc.
    trim: true
  },
  familyHead: {
    type: Boolean,
    default: false,
    index: true
  },

  parent_id: {
    type: String,
    default: null,
    index: true
  },

  district_id: {
    type: String,
    default: ''
  },
  taluka_id: {
    type: String,
    default: ''
  },
  village_id: {
    type: String,
    default: ''
  },
  village: {
    type: String,
    default: '',
    trim: true
  },
  image: {
    type: String,
    default: ''
  },
  status: {
    type: Number,
    default: 0,
    index: true
  },
  fcm_token: {
    type: String,
    default: ''
  },
  otp: { type: String, default: null },
  otp_expiry: { type: Date, default: null },
  otp_last_sent: { type: Date, default: null },
  otp_count: { type: Number, default: 0 },
  otp_reset_day: { type: Date, default: null },
  fcm_token: { type: String, default: '' }


}, {
  timestamps: true,
  strict: false, id: false
});

// Pre-save hook to hash password if it was modified
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
