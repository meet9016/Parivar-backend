const admin = require('../config/firebase');
const { getMessaging } = require('firebase-admin/messaging');
const User = require('../models/userModels');

const sendNotificationToAll = async (title, body, imageUrl = '', extraData = {}) => {
  try {
    const users = await User.find({ fcm_token: { $exists: true, $ne: '' } }, 'fcm_token').lean();
    const tokens = [...new Set(users.map(u => u.fcm_token).filter(Boolean))];
    if (!tokens.length) return;

    const dataPayload = {
      title: String(title || ''),
      body: String(body || ''),
      image: String(imageUrl || ''),
      ...Object.entries(extraData).reduce((acc, [k, v]) => {
        if (v !== undefined && v !== null) acc[k] = String(v);
        return acc;
      }, {})
    };

    // FCM supports max 500 tokens per multicast
    const chunks = [];
    for (let i = 0; i < tokens.length; i += 500) chunks.push(tokens.slice(i, i + 500));

    console.log(`[FCM Broadcast] Found ${tokens.length} user token(s) to send push notification.`);

    for (const chunk of chunks) {
      const message = {
        notification: {
          title: String(title || ''),
          body: String(body || ''),
          ...(imageUrl ? { imageUrl: String(imageUrl) } : {})
        },
        data: dataPayload,
        tokens: chunk
      };
      const response = await getMessaging().sendEachForMulticast(message);
      console.log(`[FCM Broadcast] Success: ${response.successCount}, Failed: ${response.failureCount}`);
      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            console.warn(`[FCM Error Token #${idx}]:`, resp.error?.message);
          }
        });
      }
    }
  } catch (err) {
    console.error('[FCM Broadcast Error]:', err.message);
  }
};

module.exports = { sendNotificationToAll };
