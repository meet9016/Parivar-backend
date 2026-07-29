const admin = require('../config/firebase');
const { getMessaging } = require('firebase-admin/messaging');
const User = require('../models/userModels');

const sendNotificationToAll = async (title, body, imageUrl = '') => {
  try {
    const users = await User.find({ fcm_token: { $exists: true, $ne: '' } }, 'fcm_token').lean();
    const tokens = users.map(u => u.fcm_token).filter(Boolean);
    if (!tokens.length) return;

    // FCM supports max 500 tokens per multicast
    const chunks = [];
    for (let i = 0; i < tokens.length; i += 500) chunks.push(tokens.slice(i, i + 500));

    for (const chunk of chunks) {
      const message = {
        notification: { title, body, ...(imageUrl ? { imageUrl } : {}) },
        data: { title, body },
        tokens: chunk
      };
      await getMessaging().sendEachForMulticast(message);
    }
  } catch (err) {
    console.error('FCM send error:', err.message);
  }
};

module.exports = { sendNotificationToAll };
