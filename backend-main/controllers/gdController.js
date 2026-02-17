const GDGroup = require('../models/GDGroup');
const Message = require('../models/message');

exports.getGroups = async (req, res) => {
    try {
        const groups = await GDGroup.find().sort({ createdAt: -1 });
        res.json(groups);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.createGroup = async (req, res) => {
    try {
        const { name, description, createdBy } = req.body;
        const group = new GDGroup({ name, description, createdBy });
        await group.save();
        res.status(201).json(group);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.getGroup = async (req, res) => {
    try {
        const group = await GDGroup.findById(req.params.id);
        if (!group) return res.status(404).json({ error: 'Group not found' });
        res.json(group);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.getMessages = async (req, res) => {
    try {
        const messages = await Message.find({ groupId: req.params.id })
            .sort({ createdAt: 1 })
            .populate('sender', 'name profilePic role');
        res.json(messages);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.toggleStatus = async (req, res) => {
    try {
        const { isActive } = req.body;
        const group = await GDGroup.findByIdAndUpdate(req.params.id, { isActive }, { new: true });

        try {
            const io = require('./socketController').getIo();
            io.emit('gdStatusUpdate', { id: req.params.id, isActive });
        } catch (socketError) { }

        res.json(group);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.summarizeDiscussion = async (req, res) => {
    try {
        const messages = await Message.find({ groupId: req.params.id })
            .sort({ createdAt: -1 })
            .limit(50)
            .populate('sender', 'name');

        if (messages.length === 0) return res.json({ summary: 'No discussion history available.' });

        const chronological = messages.reverse();
        let summaryText = 'Summary of Discussion:\\n\\n';

        const participants = [...new Set(chronological.map(m => m.sender?.name || 'Unknown'))];
        summaryText += 'Participants: ' + participants.join(', ') + '\\n\\n';

        const keyPoints = chronological.filter(m => m.content.length > 30);
        if (keyPoints.length > 0) {
            summaryText += 'Key Points:\\n';
            keyPoints.slice(0, 10).forEach(m => {
                summaryText += '- ' + m.sender?.name + ': ' + m.content.substring(0, 80) + '...\\n';
            });
        }

        res.json({ summary: summaryText });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};