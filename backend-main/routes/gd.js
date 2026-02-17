const express = require('express');
const router = express.Router();
const gdController = require('../controllers/gdController');

router.get('/groups', gdController.getGroups);
router.post('/create', gdController.createGroup);
router.get('/:id', gdController.getGroup);
router.get('/:id/messages', gdController.getMessages);
router.post('/:id/status', gdController.toggleStatus);
router.post('/:id/summarize', gdController.summarizeDiscussion);

module.exports = router;