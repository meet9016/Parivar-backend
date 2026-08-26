const { createTenantProxy } = require('../utils/tenantContext');
const mongoose = require('mongoose');

const inquirySchema = new mongoose.Schema(
  {
    parivar_name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    mobile: {
      type: String,
      required: true,
      trim: true,
    },
    note: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: Number,
      default: 1, // 1 = new/pending, 0 = resolved
    },
  },
  { timestamps: true }
);

module.exports = createTenantProxy('Inquiry', inquirySchema);
