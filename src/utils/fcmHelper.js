const admin = require('../config/firebase');
const { getMessaging } = require('firebase-admin/messaging');
const User = require('../models/userModels');

const sendNotificationToTokens = async (tokens = [], title, body, imageUrl = '', extraData = {}) => {
  try {
    // Safety check: Global notifications switch
    try {
      const Config = require('../models/configModel');
      const cfg = await Config.findOne().lean();
      const isFalsy = (v) => v === false || v === 'false' || v === 0 || v === '0';
      if (cfg && (isFalsy(cfg.notificationsEnabled) || isFalsy(cfg.notifications_enabled))) {
        console.log('[FCM] Notification dispatch aborted: Global notifications are turned OFF in Branding & Info');
        return;
      }
    } catch (_) {}

    const uniqueTokens = [...new Set(tokens.filter(Boolean))];
    if (!uniqueTokens.length) return;

    const dataPayload = {
      title: String(title || ''),
      body: String(body || ''),
      image: String(imageUrl || ''),
      ...Object.entries(extraData || {}).reduce((acc, [k, v]) => {
        if (v !== undefined && v !== null) {
          acc[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
        }
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
        android: {
          priority: 'high',
          notification: {
            channelId: 'default',
            sound: 'default',
            priority: 'max',
            defaultSound: true,
            defaultVibrateTimings: true,
            clickAction: 'FLUTTER_NOTIFICATION_CLICK',
            ...(imageUrl ? { imageUrl: String(imageUrl) } : {})
          }
        },
        apns: {
          headers: {
            'apns-priority': '10',
            'apns-push-type': 'alert'
          },
          payload: {
            aps: {
              alert: {
                title: String(title || ''),
                body: String(body || '')
              },
              sound: 'default',
              badge: 1,
              contentAvailable: true
            }
          }
        },
        tokens: chunk
      };
      const response = await getMessaging().sendEachForMulticast(message);
      console.log(`[FCM Multicast] Success: ${response.successCount}, Failed: ${response.failureCount}`);

      if (response.failureCount > 0) {
        const staleTokens = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const errCode = resp.error?.code || '';
            console.warn(`[FCM Error Token #${idx}]: [${errCode}] ${resp.error?.message}`);
            if (
              errCode === 'messaging/registration-token-not-registered' ||
              errCode === 'messaging/invalid-registration-token' ||
              errCode === 'messaging/mismatched-credential'
            ) {
              staleTokens.push(chunk[idx]);
            }
          }
        });

        if (staleTokens.length > 0) {
          try {
            await User.updateMany({ fcm_token: { $in: staleTokens } }, { $unset: { fcm_token: "" } });
            console.log(`[FCM] Cleaned up ${staleTokens.length} invalid/stale token(s) from database.`);
          } catch (cleanErr) {
            console.warn('[FCM Cleanup Warning]:', cleanErr.message);
          }
        }
      }
    }
  } catch (err) {
    console.error('[FCM Multicast Error]:', err.message);
  }
};

const sendNotificationToAll = async (title, body, imageUrl = '', extraData = {}) => {
  try {
    const users = await User.find({
      $or: [
        { fcm_token: { $exists: true, $ne: '' } },
        { 'fcm_tokens.0': { $exists: true } }
      ]
    }, 'fcm_token fcm_tokens').lean();
    const tokenList = [];
    users.forEach(u => {
      if (u.fcm_token && String(u.fcm_token).trim()) tokenList.push(String(u.fcm_token).trim());
      if (Array.isArray(u.fcm_tokens)) {
        u.fcm_tokens.forEach(t => {
          if (t && String(t).trim()) tokenList.push(String(t).trim());
        });
      }
    });
    const tokens = [...new Set(tokenList)];
    await sendNotificationToTokens(tokens, title, body, imageUrl, extraData);
  } catch (err) {
    console.error('[FCM Broadcast Error]:', err.message);
  }
};

const sendNotificationToUsers = async (userIds = [], title, body, imageUrl = '', extraData = {}) => {
  try {
    if (!userIds || !userIds.length) return;
    const users = await User.find(
      {
        _id: { $in: userIds },
        $or: [
          { fcm_token: { $exists: true, $ne: '' } },
          { 'fcm_tokens.0': { $exists: true } }
        ]
      },
      'fcm_token fcm_tokens'
    ).lean();
    const tokenList = [];
    users.forEach(u => {
      if (u.fcm_token && String(u.fcm_token).trim()) tokenList.push(String(u.fcm_token).trim());
      if (Array.isArray(u.fcm_tokens)) {
        u.fcm_tokens.forEach(t => {
          if (t && String(t).trim()) tokenList.push(String(t).trim());
        });
      }
    });
    const tokens = [...new Set(tokenList)];
    await sendNotificationToTokens(tokens, title, body, imageUrl, extraData);
  } catch (err) {
    console.error('[FCM Targeted Error]:', err.message);
  }
};

module.exports = { sendNotificationToAll, sendNotificationToUsers, sendNotificationToTokens };
