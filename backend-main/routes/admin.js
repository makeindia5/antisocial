const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

const upload = require('../middleware/fileUpload');

router.post('/announcement', upload.single('file'), adminController.createAnnouncement);
router.get('/announcement/list', async (req, res) => {
    try {
        const list = await require('../models/announcement').find().sort({ createdAt: -1 });
        res.json(list);
    } catch (err) { res.status(500).json({ error: err.message }); }
});
router.post('/meet', adminController.createMeet);
router.post('/gd/status', adminController.updateGDStatus);
router.get('/users', adminController.getAllUsers);
router.delete('/announcement/:id', adminController.deleteAnnouncement);
router.delete('/message/:id', adminController.deleteMessage);

// Group Routes
router.post('/group', adminController.createGroup);
router.get('/group/list', adminController.getGroups);
router.put('/group/:id', upload.single('icon'), adminController.updateGroup);
router.get('/group/:id', adminController.getGroup);
router.put('/group/:id/members', adminController.updateGroupMembers);
router.get('/group/:id/announcements', adminController.getGroupAnnouncements);
router.get('/group/:id/messages', adminController.getGroupMessages);
router.delete('/group/:id', adminController.deleteGroup);
router.post('/announcement/:id/vote', adminController.voteAnnouncement);
router.post('/company/create', adminController.createCompanyID);
router.get('/company/history/:adminId', adminController.getCompanyHistory);

module.exports = router;
