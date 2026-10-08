const { apiResponse } = require('../utils/apiResponse');
const Conversation = require('../models/Conversation');
const ConversationMember = require('../models/ConversationMember');
const Message = require('../models/Message');
const User = require('../models/userModels');
const CommitteeMember = require('../models/committeeMemberModel');
const socketManager = require('../config/socket');
const mongoose = require('mongoose');
const { getLinkedUserIds, cleanPhoneNumber } = require('../utils/chatHelper');

// Helper to get active user ID from req.user
const getReqUserId = (req) => {
  return String(req.user?.id || req.user?._id || req.user?.userId || '');
};

// Search users to start new chat (searches both Committee Members and Users)
exports.getChatUsers = async (req, res) => {
  try {
    const currentUserId = getReqUserId(req);
    const search = (req.query.search || '').trim();

    const { allIds: myIds } = await getLinkedUserIds(currentUserId);
    const myIdStrings = (myIds || []).map(String);

    const regex = search ? new RegExp(search, 'i') : null;

    // 1. Fetch Committee Members
    const cmQuery = { status: { $ne: 0 } };
    if (regex) {
      cmQuery.$or = [
        { first_name: regex },
        { last_name: regex },
        { number: regex },
        { designation: regex }
      ];
    }
    const cms = await CommitteeMember.find(cmQuery)
      .select('first_name middle_name last_name number image designation status')
      .lean();

    // 2. Fetch Users
    const userQuery = { status: { $ne: -1 } };
    if (regex) {
      userQuery.$or = [
        { first_name: regex },
        { last_name: regex },
        { number: regex }
      ];
    }
    const users = await User.find(userQuery)
      .select('first_name middle_name last_name number image profile_image village occupation role_id status')
      .limit(60)
      .lean();

    // 3. Merge & Deduplicate by phone number
    const seenNumbers = new Set();
    const result = [];

    // Prioritize Committee Members (they have admin roles/designations)
    for (const cm of cms) {
      if (myIdStrings.includes(String(cm._id))) continue;
      const cleanNum = cleanPhoneNumber(cm.number);
      if (cleanNum) seenNumbers.add(cleanNum);

      result.push({
        _id: cm._id,
        first_name: cm.first_name,
        last_name: cm.last_name,
        number: cm.number,
        image: cm.image,
        profile_image: cm.image,
        designation: cm.designation || 'Committee Member',
        is_committee: true,
        type: 'committee'
      });
    }

    // Add regular Users (if not already included as a committee member)
    for (const u of users) {
      if (myIdStrings.includes(String(u._id))) continue;
      const cleanNum = cleanPhoneNumber(u.number);
      if (cleanNum && seenNumbers.has(cleanNum)) continue;
      if (cleanNum) seenNumbers.add(cleanNum);

      result.push({
        _id: u._id,
        first_name: u.first_name,
        last_name: u.last_name,
        number: u.number,
        image: u.image || u.profile_image,
        profile_image: u.profile_image || u.image,
        designation: 'Member',
        is_committee: false,
        village: u.village,
        type: 'user'
      });
    }

    return apiResponse(res, 200, 'Users fetched successfully', result);
  } catch (err) {
    return apiResponse(res, 500, err.message);
  }
};

// Create or get private conversation
exports.createOrGetPrivateChat = async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const currentUserId = getReqUserId(req);

    if (!targetUserId) {
      return apiResponse(res, 400, 'Target user ID is required');
    }

    const { allIds: myIds, primaryId: myPrimaryId } = await getLinkedUserIds(currentUserId);
    const { allIds: targetIds, primaryId: targetPrimaryId, user: targetUserObj } = await getLinkedUserIds(targetUserId);

    if (myIds.map(String).includes(String(targetUserId))) {
      return apiResponse(res, 400, 'Cannot create chat with yourself');
    }

    // Check if a private conversation already exists between any combination of my IDs and target IDs
    const myMemberships = await ConversationMember.find({
      userId: { $in: myIds },
      isActive: true
    }).select('conversationId').lean();

    const myConvIds = myMemberships.map(m => m.conversationId);

    // Filter to ONLY private conversations (groups must never be returned for 1-to-1 chats)
    const privateConvs = await Conversation.find({
      _id: { $in: myConvIds },
      type: 'private'
    }).select('_id').lean();

    const privateConvIds = privateConvs.map(c => c._id);

    const existingTargetMember = await ConversationMember.findOne({
      userId: { $in: targetIds },
      conversationId: { $in: privateConvIds },
      isActive: true
    }).lean();

    if (existingTargetMember) {
      const existingConv = await Conversation.findById(existingTargetMember.conversationId)
        .populate('lastMessage')
        .lean();

      return apiResponse(res, 200, 'Conversation fetched successfully', {
        ...existingConv,
        otherUser: targetUserObj
      });
    }

    // Create new conversation using canonical primary IDs
    const newConversation = await Conversation.create({
      type: 'private',
      createdBy: myPrimaryId
    });

    await ConversationMember.create([
      { conversationId: newConversation._id, userId: myPrimaryId, role: 'member' },
      { conversationId: newConversation._id, userId: targetPrimaryId, role: 'member' }
    ]);

    return apiResponse(res, 201, 'Conversation created successfully', {
      ...newConversation.toObject(),
      otherUser: targetUserObj
    });
  } catch (err) {
    return apiResponse(res, 500, err.message);
  }
};

// Get conversations list for current user
exports.getConversations = async (req, res) => {
  try {
    const userId = getReqUserId(req);
    const { allIds: myIds } = await getLinkedUserIds(userId);
    const myIdObjs = myIds.map(id => mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : id);

    const memberships = await ConversationMember.find({ 
      userId: { $in: myIdObjs }, 
      isActive: true 
    })
      .populate({
        path: 'conversationId',
        populate: { path: 'lastMessage' }
      })
      .lean();

    // Deduplicate in case multiple linked IDs were in conversation
    const seenConvs = new Set();
    const uniqueMemberships = [];
    for (const m of memberships) {
      if (!m.conversationId) continue;
      const cId = String(m.conversationId._id);
      if (!seenConvs.has(cId)) {
        seenConvs.add(cId);
        uniqueMemberships.push(m);
      }
    }

    const result = await Promise.all(uniqueMemberships.map(async (membership) => {
      const conv = membership.conversationId;
      if (!conv) return null;

      // Calculate unread count (messages not sent by current user and not yet read by current user)
      const unreadCount = await Message.countDocuments({
        conversationId: conv._id,
        senderId: { $nin: myIdObjs },
        'readBy.userId': { $nin: myIdObjs }
      });

      let otherUser = null;
      if (conv.type === 'private') {
        const otherMember = await ConversationMember.findOne({
          conversationId: conv._id,
          userId: { $nin: myIdObjs },
          isActive: true
        }).lean();

        if (otherMember) {
          otherUser = await CommitteeMember.findById(otherMember.userId)
            .select('first_name last_name number image profile_image designation')
            .lean();

          if (!otherUser) {
            otherUser = await User.findById(otherMember.userId)
              .select('first_name last_name number image profile_image')
              .lean();
          }
        }
      }

      return {
        _id: conv._id,
        type: conv.type,
        name: conv.name,
        image: conv.image,
        lastMessage: conv.lastMessage,
        lastMessageAt: conv.lastMessageAt || conv.updatedAt || conv.createdAt,
        unreadCount,
        otherUser
      };
    }));

    // Sort by lastMessageAt descending
    const filteredResult = result
      .filter(Boolean)
      .sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));

    return apiResponse(res, 200, 'Conversations fetched successfully', filteredResult);
  } catch (err) {
    return apiResponse(res, 500, err.message);
  }
};

// Get conversation details
exports.getConversationDetails = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const conv = await Conversation.findById(conversationId).populate('lastMessage').lean();
    if (!conv) return apiResponse(res, 404, 'Conversation not found');
    return apiResponse(res, 200, 'Conversation details', conv);
  } catch (err) {
    return apiResponse(res, 500, err.message);
  }
};

// Get messages for a conversation
exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const rawMessages = await Message.find({ conversationId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Collect all sender IDs
    const senderIds = [...new Set(rawMessages.map(m => String(m.senderId)).filter(Boolean))];

    // Look up senders in both User and CommitteeMember collections
    const users = await User.find({ _id: { $in: senderIds } })
      .select('first_name last_name number image profile_image')
      .lean();
    const cms = await CommitteeMember.find({ _id: { $in: senderIds } })
      .select('first_name last_name number image profile_image designation')
      .lean();

    const senderMap = new Map();
    users.forEach(u => senderMap.set(String(u._id), u));
    cms.forEach(c => senderMap.set(String(c._id), c));

    const messages = rawMessages.map(m => {
      const sId = String(m.senderId);
      const sender = senderMap.get(sId) || { _id: sId, first_name: 'Member', last_name: '' };
      return {
        ...m,
        senderId: sender
      };
    });

    const total = await Message.countDocuments({ conversationId });

    // Reverse to chronological order (oldest to newest) for messaging UI display
    const orderedMessages = messages.reverse();

    return apiResponse(res, 200, 'Messages fetched successfully', {
      messages: orderedMessages,
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  } catch (err) {
    return apiResponse(res, 500, err.message);
  }
};

// Send message via REST API
exports.sendMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { message, messageType = 'text', attachments = [] } = req.body;
    const userId = getReqUserId(req);

    if (!message || !conversationId) {
      return apiResponse(res, 400, 'Message and conversationId are required');
    }

    const { allIds: myIds, primaryId: myPrimaryId } = await getLinkedUserIds(userId);
    const myIdStrings = myIds.map(String);
    const userObj = mongoose.isValidObjectId(myPrimaryId) ? new mongoose.Types.ObjectId(myPrimaryId) : myPrimaryId;

    const newMessage = await Message.create({
      conversationId,
      senderId: userObj,
      message: String(message).trim(),
      messageType,
      attachments: attachments || [],
      deliveredTo: [],
      readBy: [{ userId: userObj, readAt: new Date() }]
    });

    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: newMessage._id,
      lastMessageAt: new Date()
    });

    let populatedMessage = await Message.findById(newMessage._id).lean();

    // Populate sender info from User or CommitteeMember
    let sender = await CommitteeMember.findById(userId).select('first_name last_name number image profile_image designation').lean();
    if (!sender) {
      sender = await User.findById(userId).select('first_name last_name number image profile_image').lean();
    }
    populatedMessage.senderId = sender || { _id: userId, first_name: 'Member', last_name: '' };

    // Broadcast via Socket.IO
    try {
      const io = socketManager.getIO();

      const members = await ConversationMember.find({ conversationId, isActive: true }).select('userId').lean();
      members.forEach(m => {
        const mId = String(m.userId);
        if (!myIdStrings.includes(mId)) {
          io.to(`user_${mId}`).emit('receive_message', populatedMessage);
          io.to(`user_${mId}`).emit('conversation_updated', {
            conversationId,
            lastMessage: populatedMessage,
            lastMessageAt: populatedMessage.createdAt,
            senderId: userId
          });
          io.to(`user_${mId}`).emit('unread_count_updated', { conversationId, senderId: userId });
        }
      });
    } catch (_) {}

    return apiResponse(res, 201, 'Message sent successfully', populatedMessage);
  } catch (err) {
    return apiResponse(res, 500, err.message);
  }
};

// Create Group
exports.createGroup = async (req, res) => {
  try {
    const { name, image, memberIds } = req.body;
    const userId = getReqUserId(req);

    if (!name) return apiResponse(res, 400, 'Group name is required');

    const { primaryId } = await getLinkedUserIds(userId);

    const newGroup = await Conversation.create({
      type: 'group',
      name: name.trim(),
      image: image || null,
      createdBy: primaryId
    });

    const membersToCreate = [
      { conversationId: newGroup._id, userId: primaryId, role: 'admin' }
    ];

    if (Array.isArray(memberIds)) {
      for (const id of memberIds) {
        if (String(id) !== String(primaryId)) {
          const { primaryId: mPrimaryId } = await getLinkedUserIds(id);
          membersToCreate.push({ conversationId: newGroup._id, userId: mPrimaryId, role: 'member' });
        }
      }
    }

    await ConversationMember.create(membersToCreate);

    return apiResponse(res, 201, 'Group created successfully', newGroup);
  } catch (err) {
    return apiResponse(res, 500, err.message);
  }
};

// Get Group Members
exports.getGroupMembers = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const rawMembers = await ConversationMember.find({ conversationId, isActive: true }).lean();

    const userIds = rawMembers.map(m => m.userId);
    const users = await User.find({ _id: { $in: userIds } }).select('first_name last_name number image profile_image').lean();
    const cms = await CommitteeMember.find({ _id: { $in: userIds } }).select('first_name last_name number image profile_image designation').lean();

    const userMap = new Map();
    users.forEach(u => userMap.set(String(u._id), u));
    cms.forEach(c => userMap.set(String(c._id), c));

    const members = rawMembers.map(m => ({
      ...m,
      userId: userMap.get(String(m.userId)) || { _id: m.userId, first_name: 'Member' }
    }));

    return apiResponse(res, 200, 'Group members fetched', members);
  } catch (err) {
    return apiResponse(res, 500, err.message);
  }
};

// Add Members to Group
exports.addMembers = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { memberIds } = req.body;

    if (!Array.isArray(memberIds)) return apiResponse(res, 400, 'memberIds must be an array');

    const existingMembers = await ConversationMember.find({ conversationId }).select('userId').lean();
    const existingIds = existingMembers.map(m => String(m.userId));

    const newMembers = [];
    for (const id of memberIds) {
      const { primaryId } = await getLinkedUserIds(id);
      if (!existingIds.includes(String(primaryId))) {
        newMembers.push({ conversationId, userId: primaryId, role: 'member' });
      }
    }

    if (newMembers.length > 0) {
      await ConversationMember.create(newMembers);
    }

    return apiResponse(res, 200, 'Members added successfully');
  } catch (err) {
    return apiResponse(res, 500, err.message);
  }
};

// Remove Member
exports.removeMember = async (req, res) => {
  try {
    const { conversationId, userId } = req.params;
    const { allIds } = await getLinkedUserIds(userId);
    await ConversationMember.findOneAndUpdate(
      { conversationId, userId: { $in: allIds } },
      { isActive: false }
    );
    return apiResponse(res, 200, 'Member removed');
  } catch (err) {
    return apiResponse(res, 500, err.message);
  }
};

// Leave Group
exports.leaveGroup = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = getReqUserId(req);
    const { allIds } = await getLinkedUserIds(userId);
    await ConversationMember.findOneAndUpdate(
      { conversationId, userId: { $in: allIds } },
      { isActive: false }
    );
    return apiResponse(res, 200, 'Left group successfully');
  } catch (err) {
    return apiResponse(res, 500, err.message);
  }
};

// Update Group
exports.updateGroup = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { name, image } = req.body;

    const updated = await Conversation.findByIdAndUpdate(
      conversationId,
      { $set: { ...(name && { name }), ...(image !== undefined && { image }) } },
      { new: true }
    );
    return apiResponse(res, 200, 'Group updated successfully', updated);
  } catch (err) {
    return apiResponse(res, 500, err.message);
  }
};

// Mark Messages Read
exports.markMessagesRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = getReqUserId(req);
    const { allIds: myIds, primaryId } = await getLinkedUserIds(userId);
    const myIdObjs = myIds.map(id => mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : id);

    await ConversationMember.updateMany(
      { conversationId, userId: { $in: myIdObjs } },
      { lastReadAt: new Date() }
    );

    await Message.updateMany(
      { conversationId, 'readBy.userId': { $nin: myIdObjs } },
      { $push: { readBy: { userId: primaryId, readAt: new Date() } } }
    );

    try {
      socketManager.getIO().to(`conv_${conversationId}`).emit('messages_read', { conversationId, userId });
      myIds.forEach(id => {
        socketManager.getIO().to(`user_${id}`).emit('unread_count_updated', { conversationId });
      });
    } catch (_) {}

    return apiResponse(res, 200, 'Messages marked as read');
  } catch (err) {
    return apiResponse(res, 500, err.message);
  }
};

// Total Unread Count
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = getReqUserId(req);
    const { allIds: myIds } = await getLinkedUserIds(userId);
    const myIdObjs = myIds.map(id => mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : id);

    const memberships = await ConversationMember.find({
      userId: { $in: myIdObjs },
      isActive: true
    }).select('conversationId').lean();

    const convIds = memberships.map(m => m.conversationId);

    const totalUnread = await Message.countDocuments({
      conversationId: { $in: convIds },
      senderId: { $nin: myIdObjs },
      'readBy.userId': { $nin: myIdObjs }
    });

    return apiResponse(res, 200, 'Unread count fetched', { totalUnread });
  } catch (err) {
    return apiResponse(res, 500, err.message);
  }
};
