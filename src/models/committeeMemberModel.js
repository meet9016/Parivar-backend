const { createTenantProxy } = require('../utils/tenantContext');
const mongoose = require('mongoose');

const committeeMemberSchema = new mongoose.Schema({
  first_name: {
    type: String,
    required: true
  },
  middle_name: {
    type: String
  },
  last_name: {
    type: String,
    required: true
  },
  number: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    sparse: true
  },
  password: {
    type: String,
    select: false
  },
  role_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role'
  },
  image: {
    type: String
  },
  designation: {
    type: String,
    default: ''
  },
  status: {
    type: Number,
    default: 1
  }
}, { timestamps: true });

module.exports = createTenantProxy('CommitteeMember', committeeMemberSchema);
