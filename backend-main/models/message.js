const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // For 1:1 chat
    groupId: { type: String }, // For group chats (e.g., 'finance-gd')
    announcementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Announcement' }, // For announcement replies (if allowed) or broadcasts
    content: { type: String, required: true },
    type: { type: String, enum: ['text', 'image', 'video', 'document', 'video_link', 'location'], default: 'text' },
    read: { type: Boolean, default: false }, // Legacy for 1:1
    readBy: [{ // For Group Chats
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        readAt: { type: Date, default: Date.now }
    }],
    reactions: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        emoji: { type: String, required: true }
    }],
    status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
    createdAt: { type: Date, default: Date.now },
    starredBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});

module.exports = mongoose.model('Message', messageSchema);
