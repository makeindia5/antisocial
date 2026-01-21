const mongoose = require('mongoose');

const StatusSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['image', 'text', 'video'],
        default: 'image'
    },
    content: {
        type: String, // URL for image/video or Text content
        required: true
    },
    caption: {
        type: String
    },
    viewers: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        viewedAt: { type: Date, default: Date.now }
    }],
    color: {
        type: String, // For text status background
        default: '#000000'
    },
    expiresAt: {
        type: Date,
        default: () => new Date(+new Date() + 24 * 60 * 60 * 1000) // 24 hours from now
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Index to automatically delete documents after they expire
StatusSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Status', StatusSchema);
