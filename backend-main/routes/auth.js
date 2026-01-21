const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const User = require('../models/user');
const upload = require('../middleware/fileUpload');

router.post("/signup", authController.signup);
router.post("/login", authController.login);
router.post('/upload-avatar', upload.single('image'), authController.uploadAvatar);
router.post('/upload', upload.single('file'), authController.uploadFile);

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
router.put('/vote', authController.votePoll);
router.get('/counts', authController.getUnreadCounts);
router.post('/meet/schedule', authController.scheduleMeeting);
router.get('/meet/list', authController.getMeetings);
router.post('/company/verify', authController.verifyCompanyID);
router.post('/privacy/toggle', authController.toggleNumberPrivacy);

// Missing Function Routes (Keep Commented)
// router.post('/gd/create', authController.createGDGroup);
// router.post('/chat/group/create', authController.createChatGroup);
// router.post('/chat/group/pin/:groupId', authController.toggleChatGroupPin);
// router.get('/chat/group/details/:groupId', authController.getChatGroup);
// router.get('/chat/group/messages/:groupId', authController.getChatGroupMessages);
// router.get('/chat/groups/:userId', authController.getUserChatGroups);
router.get('/user/:userId', authController.getUserDetails);
// Status Routes
router.post('/status/create', authController.createStatus);
router.delete('/status/:statusId', authController.deleteStatus);
router.get('/status/feed', authController.getStatuses);
// router.get('/gd/groups', authController.getGDGroups);
// router.post('/chat/group/promote/:groupId', authController.promoteToAdmin);
// router.post('/chat/group/remove/:groupId', authController.removeFromGroup);
// router.post('/chat/group/add/:groupId', authController.addMemberToGroup);
// router.post('/chat/group/description/:groupId', authController.updateGroupDescription);

module.exports = router;