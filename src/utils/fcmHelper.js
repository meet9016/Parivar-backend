const admin = require('../config/firebase');
const { getMessaging } = require('firebase-admin/messaging');
const User = require('../models/userModels');

const sendNotificationToTokens = async (tokens = [], title, body, imageUrl = '', extraData = {}) => {
  try {
    const uniqueTokens = [...new Set(tokens.filter(Boolean))];
    if (!uniqueTokens.length) return;

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
    for (let i = 0; i < uniqueTokens.length; i += 500) chunks.push(uniqueTokens.slice(i, i + 500));

    console.log(`[FCM Multicast] Sending to ${uniqueTokens.length} token(s)...`);

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
      console.log(`[FCM Multicast] Success: ${response.successCount}, Failed: ${response.failureCount}`);
      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            console.warn(`[FCM Error Token #${idx}]:`, resp.error?.message);
          }
        });
      }
    }
  } catch (err) {
    console.error('[FCM Multicast Error]:', err.message);
  }
};

const sendNotificationToAll = async (title, body, imageUrl = '', extraData = {}) => {
  try {
    const users = await User.find({ fcm_token: { $exists: true, $ne: '' } }, 'fcm_token').lean();
    const tokens = users.map(u => u.fcm_token).filter(Boolean);
    await sendNotificationToTokens(tokens, title, body, imageUrl, extraData);
  } catch (err) {
    console.error('[FCM Broadcast Error]:', err.message);
  }
};

const sendNotificationToUsers = async (userIds = [], title, body, imageUrl = '', extraData = {}) => {
  try {
    if (!userIds || !userIds.length) return;
    const users = await User.find(
      { _id: { $in: userIds }, fcm_token: { $exists: true, $ne: '' } },
      'fcm_token'
    ).lean();
    const tokens = users.map(u => u.fcm_token).filter(Boolean);
    await sendNotificationToTokens(tokens, title, body, imageUrl, extraData);
  } catch (err) {
    console.error('[FCM Targeted Error]:', err.message);
  }
};

module.exports = { sendNotificationToAll, sendNotificationToUsers, sendNotificationToTokens };

