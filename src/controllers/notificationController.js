const Notification = require('../models/notificationModel');
const { apiResponse } = require('../utils/apiResponse');
const { sendNotificationToAll } = require('../utils/fcmHelper');
const socketManager = require('../config/socket');

// Called internally when news/event is created with send_notification=true
const createAndBroadcast = async ({ title, body, image = '', type = 'news', ref_id = '' }) => {
  const notif = await Notification.create({ title, body, image, type, ref_id });

  // Socket broadcast to all connected clients
  try {
    socketManager.getIO().to('broadcast').emit('new_notification', {
      _id: notif._id,
      title: notif.title,
      body: notif.body,
      image: notif.image,
      type: notif.type,
      ref_id: notif.ref_id,
      createdAt: notif.createdAt,
    });
  } catch (_) {}

  // FCM push to all users with token
  sendNotificationToAll(title, body, image);

  return notif;
};

//  list with unread count for logged-in user
const getNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      Notification.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments()
    ]);

    const unreadCount = await Notification.countDocuments({
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
    await Notification.updateMany(
      { read_by: { $nin: [userId] } },
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
    const count = await Notification.countDocuments({ read_by: { $nin: [userId] } });
    return apiResponse(res, 200, 'Unread count', { count });
  } catch (err) {
    return apiResponse(res, 500, err.message);
  }
};

module.exports = { createAndBroadcast, getNotifications, markRead, markAllRead, getUnreadCount };
