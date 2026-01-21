const mongoose = require('mongoose');

const ChatGroupSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        default: ''
    },
    type: {
        type: String,
        enum: ['group', 'announcement'],
        default: 'group'
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    members: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    admins: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    icon: {
        type: String,
        default: ''
    },
    pinnedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastMessage: {
        content: String,
        sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        createdAt: Date
    }
});

module.exports = mongoose.model('ChatGroup', ChatGroupSchema);
