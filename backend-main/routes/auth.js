const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const chatGroupController = require("../controllers/chatGroupController");

const reelController = require("../controllers/reelController");
const User = require('../models/user');
const upload = require('../middleware/fileUpload');

const postController = require("../controllers/postController");

router.post("/signup", authController.signup);
router.post("/login", authController.login);
router.post('/upload-avatar', upload.single('image'), authController.uploadAvatar);
router.post('/upload', upload.single('file'), authController.uploadFile);
router.post('/update-profile', authController.updateProfile);

router.get('/admin-id', async (req, res) => {
    try {
        const admin = await User.findOne({ role: 'admin' });
        if (admin) res.json({ adminId: admin._id });
        else res.status(404).json({ error: "No admin found" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/gd/status', async (req, res) => {
    try {
        const GDStatus = require('../models/gdStatus');
        let status = await GDStatus.findOne();
        if (!status) status = { isActive: false };
        res.json(status);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/gd/messages', authController.getGDMessages);
router.get('/gd/summary', authController.getGDSummary);
router.get('/community/users', authController.getCommunityUsers);
router.get('/messages/:user1/:user2', authController.getPrivateMessages);
router.get('/messages/summary/:user1/:user2', authController.getPrivateSummary);
router.post('/messages/clear', authController.clearChatHistory);
router.put('/vote', authController.votePoll);
router.get('/counts', authController.getUnreadCounts);
router.post('/meet/schedule', authController.scheduleMeeting);
router.post('/meet/verify', authController.verifyMeeting);
router.get('/meet/list', authController.getMeetings);
router.post('/meet/start', authController.startMeeting);
router.post('/meet/end', authController.endMeeting);
router.post('/company/verify', authController.verifyCompanyID);
router.post('/privacy/toggle', authController.toggleNumberPrivacy);

router.post('/gd/create', chatGroupController.createGDGroup);
router.post('/chat/group/create', chatGroupController.createChatGroup);
router.post('/chat/group/pin/:groupId', chatGroupController.toggleChatGroupPin);
router.get('/chat/group/details/:groupId', chatGroupController.getChatGroup);
router.get('/chat/group/messages/:groupId', chatGroupController.getChatGroupMessages);
router.get('/chat/groups/:userId', chatGroupController.getUserChatGroups);
router.get('/user/:userId', authController.getUserDetails);
// Status Routes
router.post('/status/create', authController.createStatus);
router.delete('/status/:statusId', authController.deleteStatus);

// Community Routes
const communityController = require('../controllers/communityController');
router.post('/community/create', communityController.createCommunity);
router.get('/community/list/:userId', communityController.getCommunities);
router.get('/community/details/:communityId', communityController.getCommunityDetails);
router.post('/community/group/create', communityController.createGroupInCommunity);
router.post('/community/members/add', communityController.addMembersToCommunity);
router.delete('/community/:communityId', communityController.deleteCommunity);
router.post('/community/exit', communityController.exitCommunity);
router.post('/community/clear-chat', communityController.clearCommunityChat);
router.post('/status/view', authController.viewStatus);
router.get('/status/feed', authController.getStatuses);
router.get('/gd/groups', chatGroupController.getGDGroups);
router.post('/chat/group/promote/:groupId', chatGroupController.promoteToAdmin);
router.post('/chat/group/remove/:groupId', chatGroupController.removeFromGroup);
router.post('/chat/group/add/:groupId', chatGroupController.addMemberToGroup);
router.put('/chat/group/settings/:groupId', chatGroupController.updateGroupSettings);
router.put('/chat/group/icon/:groupId', chatGroupController.updateGroupIcon);
router.delete('/chat/group/:groupId', chatGroupController.deleteChatGroup);
router.put('/chat/group/mute/:groupId', chatGroupController.toggleMuteGroup);

router.get('/devices/:userId', authController.getLinkedDevices);
router.post('/devices/remove', authController.removeLinkedDevice);

// Reel Routes
router.post('/reels/create', reelController.createReel);
router.get('/reels/feed', reelController.getReels);
router.get('/reels/user/:userId', reelController.getUserReels);
router.post('/reels/like', reelController.likeReel);
router.post('/reels/comment', reelController.commentReel);
router.post('/reels/delete', reelController.deleteReel);

// Post Routes
router.post('/posts/create', postController.createPost);
router.get('/posts/feed', postController.getFeed);
router.get('/posts/user/:userId', postController.getUserPosts);
router.post('/posts/like', postController.likePost);
router.post('/posts/comment', postController.commentPost);
router.post('/posts/delete', postController.deletePost);
router.get('/posts/explore', postController.getExploreFeed);

// Social System
router.post('/social/follow', authController.followUser);
router.post('/social/unfollow', authController.unfollowUser);
router.get('/social/suggested/:userId', authController.getSuggestedUsers);

// Features: Archive & Starred
router.post('/chat/archive', authController.toggleArchiveChat);
router.get('/chat/archived/:userId', authController.getArchivedChats);
router.get('/chat/deleted/:userId', authController.getDeletedChats);
router.get('/social/blocked/:userId', authController.getBlockedUsers);
router.post('/chat/delete', authController.deleteChat);
router.post('/social/block', authController.toggleBlockUser);
router.post('/message/star', authController.toggleStarMessage);
router.get('/message/starred/:userId', authController.getStarredMessages);

router.get('/social/notifications/:userId', authController.getNotifications);
router.post('/social/notifications/read', authController.markNotificationsRead);

module.exports = router;
