const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  title: { type: String, required: true },
  body: { type: String, default: '' },
  image: { type: String, default: '' },
  type: { type: String, default: 'news' }, 
  ref_id: { type: String, default: '' },   
  read_by: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], 
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
