const { createTenantProxy } = require('../utils/tenantContext');
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  title: { type: String, required: true },
  body: { type: String, default: '' },
  image: { type: String, default: '' },
  type: { type: String, default: 'news' }, 
  ref_id: { type: String, default: '' },   
  target_type: { 
    type: String, 
    enum: ['all', 'committee', 'specific'], 
    default: 'all' 
  },
  target_users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  read_by: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  date: { type: Date, default: null },
  expires_at: { type: Date, default: null, index: { expires: 0 } },
}, { timestamps: true });


module.exports = createTenantProxy('Notification', notificationSchema);

