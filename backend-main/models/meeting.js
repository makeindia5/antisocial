const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema({
    title: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    scheduledTime: { type: Date, required: true },
    hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    meetingType: { type: String, enum: ['instant', 'scheduled'], default: 'scheduled' },
    isStarted: { type: Boolean, default: false },
    isEnded: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Meeting', meetingSchema);
