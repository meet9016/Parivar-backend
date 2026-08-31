const mongoose = require('mongoose');

/**
 * Central Registry — stored in the "parivar_registry" database.
 * Every new Parivar registration creates one document here.
 */
const tenantSchema = new mongoose.Schema(
  {
    // Human-readable community name  e.g. "Patel Parivar"
    parivar_name: {
      type: String,
      required: true,
      trim: true,
    },

    community_type: {
      type: String,
      default: 'Parivar',
    },

    // URL-safe slug  e.g. "patel"  (used as DB name suffix)
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    // Actual MongoDB database name  e.g. "parivar_patel"
    db_name: {
      type: String,
      required: true,
      unique: true,
    },

    // Admin details seeded into the tenant DB on creation
    admin: {
      first_name: { type: String, required: true },
      last_name:  { type: String, default: '' },
      email:      { type: String, required: true, lowercase: true, trim: true, index: true },
      mobile:     { type: String, required: true },
    },

    // Plan / metadata
    plan:   { type: String, default: 'basic' },  // basic | pro | enterprise
    status: { type: Number, default: 1 },         // 1=active, 0=suspended

    // Timestamps when admin was seeded successfully
    seeded_at: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = tenantSchema;
