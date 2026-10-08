const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  tenant_code: { type: String, default: null }, // Multi-tenant support if needed
  type: {
    type: String,
    enum: ['private', 'group'],
    required: true
  },
  name: {
    type: String, // Only for groups
    default: null
  },
  image: {
    type: String, // Only for groups
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  lastMessageAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

conversationSchema.index({ type: 1 });
conversationSchema.index({ lastMessageAt: -1 });

const { createTenantProxy } = require('../utils/tenantContext');
module.exports = createTenantProxy('Conversation', conversationSchema);
