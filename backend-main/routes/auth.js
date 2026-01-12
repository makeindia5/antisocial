const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const User = require('../models/user');
const upload = require('../middleware/fileUpload');

router.post("/signup", authController.signup);
router.post("/login", authController.login);
router.post('/upload-avatar', upload.single('image'), authController.uploadAvatar);

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
router.put('/vote', authController.votePoll);
router.get('/counts', authController.getUnreadCounts); // Unread Counts Endpoint
router.post('/meet/schedule', authController.scheduleMeeting);
router.get('/meet/list', authController.getMeetings);
router.post('/company/verify', authController.verifyCompanyID);
router.post('/privacy/toggle', authController.toggleNumberPrivacy);
module.exports = router;