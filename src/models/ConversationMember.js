const mongoose = require('mongoose');

const conversationMemberSchema = new mongoose.Schema({
  tenant_code: { type: String, default: null },
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  role: {
    type: String,
    enum: ['admin', 'member'],
    default: 'member'
  },
  lastReadAt: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

conversationMemberSchema.index({ conversationId: 1, userId: 1 });
conversationMemberSchema.index({ userId: 1 });

const { createTenantProxy } = require('../utils/tenantContext');
module.exports = createTenantProxy('ConversationMember', conversationMemberSchema);
