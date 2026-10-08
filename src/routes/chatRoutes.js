const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { protect } = require('../middleware/auth');

// Apply auth middleware to all chat routes
router.use(protect);

// Users list for starting chats
router.get('/users', chatController.getChatUsers);

// Private Chat (Create or Get existing)
router.post('/private', chatController.createOrGetPrivateChat);

// Chat List
router.get('/conversations', chatController.getConversations);

// Unread Count
router.get('/unread-count', chatController.getUnreadCount);

// Create Group
router.post('/group', chatController.createGroup);

// Messages: Get & Send
router.get('/:conversationId/messages', chatController.getMessages);
router.post('/:conversationId/messages', chatController.sendMessage);

// Group Members
router.get('/:conversationId/members', chatController.getGroupMembers);
router.post('/:conversationId/members', chatController.addMembers);
router.delete('/:conversationId/members/:userId', chatController.removeMember);

// Leave Group
router.post('/:conversationId/leave', chatController.leaveGroup);

// Update Group
router.patch('/:conversationId', chatController.updateGroup);

// Mark Read
router.post('/:conversationId/read', chatController.markMessagesRead);
router.put('/:conversationId/read', chatController.markMessagesRead);

// Conversation Details
router.get('/:conversationId', chatController.getConversationDetails);

module.exports = router;
