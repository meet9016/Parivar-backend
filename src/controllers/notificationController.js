const Notification = require('../models/notificationModel');
const User = require('../models/userModels');
const { apiResponse } = require('../utils/apiResponse');
const { sendNotificationToAll, sendNotificationToUsers } = require('../utils/fcmHelper');
const socketManager = require('../config/socket');

// Called internally when news/event is created with send_notification=true
const createAndBroadcast = async ({ 
  title, 
  body, 
  image = '', 
  type = 'news', 
  ref_id = '', 
  date = '', 
  target_type = 'all', 
  target_users = [], 
  ...rest 
}) => {
  // If this is a prayer timetable notification and notifications are turned OFF, suppress completely
  if (type === 'prayer_reminder' && !rest.is_test) {
    try {
      const Config = require('../models/configModel');
      const cfg = await Config.findOne().lean();
      const pt = cfg?.prayerTimes;
      const isFalsy = (v) => v === false || v === 'false' || v === 0 || v === '0';
      const isOff = !pt || isFalsy(pt.notificationsEnabled) || isFalsy(pt.notifications_enabled) || isFalsy(pt.enabled);
      if (isOff) {
        console.log('[createAndBroadcast] 🚫 Prayer reminder notification suppressed because prayerTimes.notificationsEnabled is OFF');
        return null;
      }
    } catch (checkErr) {
      console.warn('[createAndBroadcast] Warning checking prayer notification status:', checkErr.message);
    }
  }

  // Normalize target_users
  let cleanTargetUserIds = [];
  if (Array.isArray(target_users)) {
    cleanTargetUserIds = target_users.map(u => typeof u === 'object' ? (u.id || u._id || u) : u).filter(Boolean);
  } else if (typeof target_users === 'string') {
    try {
      const parsed = JSON.parse(target_users);
      if (Array.isArray(parsed)) {
        cleanTargetUserIds = parsed.map(u => typeof u === 'object' ? (u.id || u._id || u) : u).filter(Boolean);
      } else if (target_users.trim()) {
        cleanTargetUserIds = target_users.split(',').map(s => s.trim()).filter(Boolean);
      }
    } catch (_) {
      cleanTargetUserIds = target_users.split(',').map(s => s.trim()).filter(Boolean);
    }
  }

  const notifData = {
    title,
    body,
    image,
    type,
    ref_id,
    target_type: ['all', 'committee', 'specific'].includes(target_type) ? target_type : 'all',
    target_users: target_type === 'specific' ? cleanTargetUserIds : [],
    date: date ? new Date(date) : new Date(),
    expires_at: rest.expires_at ? new Date(rest.expires_at) : null,
    key: rest.key || rest.push_key || '',
    push_key: rest.push_key || rest.key || '',
    prayer: rest.prayer || '',
    prayer_name: rest.prayer_name || '',
    prayer_type: rest.prayer_type || '',
    prayer_time: rest.prayer_time || '',
    lead_minutes: rest.lead_minutes !== undefined ? rest.lead_minutes : null,
    ...rest
  };

  // Save notification record quickly
  const notif = await Notification.create(notifData);

  const payload = {
    _id: notif._id,
    title: notif.title,
    body: notif.body,
    image: notif.image,
    type: notif.type,
    ref_id: notif.ref_id,
    target_type: notif.target_type,
    date: date || notif.createdAt,
    createdAt: notif.createdAt,
    ...rest
  };

  const fcmExtra = {
    type,
    ref_id: String(ref_id || ''),
    date: String(date || notif.createdAt || ''),
    notification_id: String(notif._id),
    ...rest
  };

  // Dispatch Socket.IO and FCM asynchronously in background (Non-blocking for fast API response)
  setImmediate(async () => {
    // 1. Socket.IO Broadcast (isolated)
    try {
      const io = socketManager.getIO();
      if (io) {
        if (notif.target_type === 'committee') {
          const committeeMembers = await User.find({ is_committee: true }, '_id').lean();
          committeeMembers.forEach(m => {
            io.to(`user_${m._id}`).emit('new_notification', payload);
          });
        } else if (notif.target_type === 'specific' && cleanTargetUserIds.length > 0) {
          cleanTargetUserIds.forEach(uid => {
            io.to(`user_${uid}`).emit('new_notification', payload);
          });
        } else {
          io.to('broadcast').emit('new_notification', payload);
        }
      }
    } catch (socketErr) {
      console.warn('[Socket.IO Emit Warning]:', socketErr.message);
    }

    // 2. FCM Push Notification to Mobile Devices (isolated and awaited)
    try {
      if (notif.target_type === 'committee') {
        const committeeMembers = await User.find({ is_committee: true }, '_id').lean();
        const userIds = committeeMembers.map(m => m._id);
        await sendNotificationToUsers(userIds, title, body, image, fcmExtra);
      } else if (notif.target_type === 'specific' && cleanTargetUserIds.length > 0) {
        await sendNotificationToUsers(cleanTargetUserIds, title, body, image, fcmExtra);
      } else {
        await sendNotificationToAll(title, body, image, fcmExtra);
      }
    } catch (fcmErr) {
      console.error('[FCM Dispatch Error]:', fcmErr.message);
    }
  });

  return notif;
};

// Helper to construct query for notifications accessible by current user
const getUserNotificationQuery = (user) => {
  const userId = user._id;
  const isCommittee = user.is_committee === true;
  const now = new Date();

  const audienceConditions = [
    { target_type: 'all' },
    { target_type: { $exists: false } },
    { target_type: null },
    { target_users: userId }
  ];

  if (isCommittee) {
    audienceConditions.push({ target_type: 'committee' });
  }

  // Filter out notifications that have already expired (e.g. past birthdays/anniversaries)
  return {
    $and: [
      { $or: audienceConditions },
      {
        $or: [
          { expires_at: { $exists: false } },
          { expires_at: null },
          { expires_at: { $gt: now } }
        ]
      }
    ]
  };
};

// list with unread count for logged-in user
const getNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const skip = (page - 1) * limit;

    const baseQuery = getUserNotificationQuery(req.user);

    const [notifications, total] = await Promise.all([
      Notification.find(baseQuery).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments(baseQuery)
    ]);

    const unreadCount = await Notification.countDocuments({
      ...baseQuery,
      read_by: { $nin: [userId] }
    });

    const formatted = notifications.map(n => ({
      ...n,
      is_read: n.read_by?.some(id => String(id) === String(userId)) || false
    }));

    return apiResponse(res, 200, 'Notifications fetched', formatted, {
      page, limit, total,
      totalPages: Math.ceil(total / limit),
      unread: unreadCount
    });
  } catch (err) {
    return apiResponse(res, 500, err.message);
  }
};


const markRead = async (req, res) => {
  try {
    const userId = req.user._id;
    await Notification.findByIdAndUpdate(req.params.id, {
      $addToSet: { read_by: userId }
    });
    return apiResponse(res, 200, 'Marked as read');
  } catch (err) {
    return apiResponse(res, 500, err.message);
  }
};

const markAllRead = async (req, res) => {
  try {
    const userId = req.user._id;
    const baseQuery = getUserNotificationQuery(req.user);
    await Notification.updateMany(
      { ...baseQuery, read_by: { $nin: [userId] } },
      { $addToSet: { read_by: userId } }
    );
    return apiResponse(res, 200, 'All marked as read');
  } catch (err) {
    return apiResponse(res, 500, err.message);
  }
};

const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user._id;
    const baseQuery = getUserNotificationQuery(req.user);
    const count = await Notification.countDocuments({ ...baseQuery, read_by: { $nin: [userId] } });
    return apiResponse(res, 200, 'Unread count', { count });
  } catch (err) {
    return apiResponse(res, 500, err.message);
  }
};

module.exports = { createAndBroadcast, getNotifications, markRead, markAllRead, getUnreadCount };
