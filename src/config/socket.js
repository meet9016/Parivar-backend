const jwt = require('jsonwebtoken');
const ConversationMember = require('../models/ConversationMember');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/userModels');
const CommitteeMember = require('../models/committeeMemberModel');
const mongoose = require('mongoose');
const { getLinkedUserIds } = require('../utils/chatHelper');

let _io = null;

// Track online users in memory: userId -> Set of socketIds
const onlineUsers = new Map();

module.exports = {
  init: (httpServer) => {
    const { Server } = require('socket.io');
    _io = new Server(httpServer, {
      cors: { 
        origin: '*', 
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        credentials: true
      }
    });

    // Middleware for Socket Auth
    _io.use((socket, next) => {
      const rawToken = socket.handshake.auth?.token || socket.handshake.headers?.token || socket.handshake.query?.token;
      if (!rawToken) {
        return next(new Error('Authentication error: No token provided'));
      }

      const token = String(rawToken).replace(/^Bearer\s+/i, '').trim();

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretfamilykey');
        socket.user = decoded;
        return next();
      } catch (err) {
        // Fallback for alternate secret
        try {
          const decoded2 = jwt.verify(token, 'ParivarApp2024$');
          socket.user = decoded2;
          return next();
        } catch (e) {
          console.error('Socket JWT Auth Error:', err.message);
          return next(new Error('Authentication error: ' + err.message));
        }
      }
    });

    _io.on('connection', async (socket) => {
      const userId = String(socket.user.id || socket.user._id || socket.user.userId || '');
      if (!userId) {
        socket.disconnect();
        return;
      }

      // Resolve all linked IDs (CommitteeMember <-> User) for this person
      let linkedIds = [userId];
      try {
        const { allIds } = await getLinkedUserIds(userId);
        if (allIds && allIds.length > 0) {
          linkedIds = allIds.map(String);
        }
      } catch (_) {}

      // Add to online users for all linked IDs
      linkedIds.forEach(id => {
        if (!onlineUsers.has(id)) {
          onlineUsers.set(id, new Set());
        }
        onlineUsers.get(id).add(socket.id);
        socket.broadcast.emit('user_online', { userId: id });
        socket.join(`user_${id}`);
      });

      socket.join('broadcast');

      // Allow client to query current online users list
      socket.on('get_online_users', (callback) => {
        if (typeof callback === 'function') {
          callback(Array.from(onlineUsers.keys()));
        }
      });

      // === CHAT EVENTS ===

      // Join Conversation Room
      socket.on('join_conversation', async (conversationId) => {
        try {
          if (!conversationId) return;
          socket.join(`conv_${conversationId}`);
        } catch (err) {
          console.error('Error joining conversation', err);
        }
      });

      // Leave Conversation Room
      socket.on('leave_conversation', (conversationId) => {
        if (conversationId) {
          socket.leave(`conv_${conversationId}`);
        }
      });

      // Send Message
      socket.on('send_message', async (data, callback) => {
        try {
          const { conversationId, message, messageType = 'text', attachments = [] } = data || {};

          if (!message || !conversationId) {
            if (typeof callback === 'function') {
              callback({ success: false, error: 'Message and conversationId are required' });
            }
            return;
          }

          const userObj = mongoose.isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : userId;

          // Save message to database
          const newMessage = await Message.create({
            conversationId,
            senderId: userObj,
            message: String(message).trim(),
            messageType: messageType || 'text',
            attachments: Array.isArray(attachments) ? attachments : [],
            deliveredTo: [],
            readBy: [{ userId: userObj, readAt: new Date() }]
          });

          // Update conversation timestamp and lastMessage
          await Conversation.findByIdAndUpdate(conversationId, {
            lastMessage: newMessage._id,
            lastMessageAt: new Date()
          });

          // Populate sender info
          let populatedMessage = await Message.findById(newMessage._id)
            .populate('senderId', 'first_name last_name image profile_image number')
            .lean();

          if (!populatedMessage.senderId) {
            const cm = await CommitteeMember.findById(userId).select('first_name last_name image profile_image number designation').lean();
            if (cm) {
              populatedMessage.senderId = cm;
            } else {
              populatedMessage.senderId = { _id: userId, first_name: 'Member', last_name: '' };
            }
          }

          if (data?.clientTempId) {
            populatedMessage.clientTempId = data.clientTempId;
          }

          // If the sender has other tabs/windows open, notify their other sockets across all linked IDs
          linkedIds.forEach(id => {
            socket.broadcast.to(`user_${id}`).emit('receive_message', populatedMessage);
          });

          // Notify each recipient member once (to their personal room user_mId)
          const members = await ConversationMember.find({ conversationId, isActive: true }).select('userId').lean();
          members.forEach(m => {
            const mId = String(m.userId);
            if (!linkedIds.includes(mId)) {
              _io.to(`user_${mId}`).emit('receive_message', populatedMessage);
              _io.to(`user_${mId}`).emit('conversation_updated', {
                conversationId,
                lastMessage: populatedMessage,
                lastMessageAt: populatedMessage.createdAt,
                senderId: userId
              });
              _io.to(`user_${mId}`).emit('unread_count_updated', {
                conversationId,
                senderId: userId
              });
            }
          });
          
          if (typeof callback === 'function') {
            callback({ success: true, message: populatedMessage });
          }
        } catch (err) {
          console.error('Error sending message:', err);
          if (typeof callback === 'function') {
            callback({ success: false, error: err.message });
          }
        }
      });

      // Typing indicators
      socket.on('typing_start', ({ conversationId } = {}) => {
        if (conversationId) {
          socket.to(`conv_${conversationId}`).emit('typing_start', { conversationId, userId });
        }
      });

      socket.on('typing_stop', ({ conversationId } = {}) => {
        if (conversationId) {
          socket.to(`conv_${conversationId}`).emit('typing_stop', { conversationId, userId });
        }
      });

      // Message Read / Seen
      socket.on('mark_read', async ({ conversationId } = {}) => {
        try {
          if (!conversationId) return;
          const userObj = mongoose.isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : userId;
          const userMatches = linkedIds.map(id => mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : id);

          await ConversationMember.updateMany(
            { conversationId, userId: { $in: userMatches } },
            { lastReadAt: new Date() }
          );
          await Message.updateMany(
            { conversationId, 'readBy.userId': { $nin: userMatches } },
            { $push: { readBy: { userId: userObj, readAt: new Date() } } }
          );
          socket.to(`conv_${conversationId}`).emit('messages_read', { conversationId, userId });
          linkedIds.forEach(id => {
            _io.to(`user_${id}`).emit('unread_count_updated', { conversationId });
          });
        } catch (err) {
          console.error('Error marking messages as read:', err);
        }
      });

      // Disconnect
      socket.on('disconnect', () => {
        linkedIds.forEach(id => {
          const userSockets = onlineUsers.get(id);
          if (userSockets) {
            userSockets.delete(socket.id);
            if (userSockets.size === 0) {
              onlineUsers.delete(id);
              _io.emit('user_offline', { userId: id });
            }
          }
        });
      });
    });

    return _io;
  },

  getIO: () => {
    if (!_io) throw new Error('Socket.io not initialized');
    return _io;
  }
};
