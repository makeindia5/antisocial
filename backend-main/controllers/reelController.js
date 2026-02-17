const Reel = require('../models/Reel');
const User = require('../models/user');
const Notification = require('../models/Notification');

exports.createReel = async (req, res) => {
    try {
        const { userId, caption, url, thumbnail } = req.body;
        const newReel = new Reel({
            user: userId,
            url,
            caption,
            thumbnail
        });
        await newReel.save();
        await newReel.populate('user', 'name profilePic');
        res.status(201).json(newReel);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.getReels = async (req, res) => {
    try {
        const reels = await Reel.find()
            .sort({ createdAt: -1 })
            .populate('user', 'name profilePic');
        res.json(reels);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.likeReel = async (req, res) => {
    try {
        const { reelId, userId } = req.body;
        const reel = await Reel.findById(reelId);
        if (!reel) return res.status(404).json({ error: 'Reel not found' });

        const index = reel.likes.indexOf(userId);
        if (index === -1) {
            reel.likes.push(userId);
            // Create notification
            if (reel.user.toString() !== userId) {
                await Notification.create({
                    recipient: reel.user,
                    sender: userId,
                    type: 'like',
                    reelId: reel._id
                });
            }
        } else {
            reel.likes.splice(index, 1);
        }
        await reel.save();
        res.json({ success: true, likes: reel.likes });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.commentReel = async (req, res) => {
    try {
        const { reelId, userId, text } = req.body;
        const reel = await Reel.findById(reelId);
        if (!reel) return res.status(404).json({ error: 'Reel not found' });

        reel.comments.push({ user: userId, text });
        await reel.save();

        // Create notification
        if (reel.user.toString() !== userId) {
            await Notification.create({
                recipient: reel.user,
                sender: userId,
                type: 'comment',
                reelId: reel._id,
                commentText: text
            });
        }

        // Return full comments with user populated
        await reel.populate('comments.user', 'name profilePic');
        res.json({ success: true, comments: reel.comments });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.getUserReels = async (req, res) => {
    try {
        const { userId } = req.params;
        const reels = await Reel.find({ user: userId }).sort({ createdAt: -1 });
        res.json(reels);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.deleteReel = async (req, res) => {
    try {
        const { reelId, userId } = req.body;
        const reel = await Reel.findById(reelId);

        if (!reel) {
            return res.status(404).json({ error: 'Reel not found' });
        }

        if (reel.user.toString() !== userId) {
            return res.status(403).json({ error: 'Unauthorized to delete this reel' });
        }

        await Reel.findByIdAndDelete(reelId);
        res.json({ success: true, message: 'Reel deleted successfully' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};
