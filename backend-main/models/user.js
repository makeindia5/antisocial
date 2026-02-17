const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    profilePic: {
        type: String,
        default: ''
    },
    hasCompanyAccess: {
        type: Boolean,
        default: false
    },
    isNumberHidden: {
        type: Boolean,
        default: false
    },
    phoneNumber: {
        type: String,
        default: ''
    },
    linkedDevices: [{
        deviceId: { type: String, required: true }, // Unique ID for the session/device
        name: { type: String, default: 'Web Browser' },
        lastActive: { type: Date, default: Date.now }
    }],
    status: {
        type: String,
        enum: ['online', 'offline'],
        default: 'offline'
    },
    statusPrivacy: {
        type: String,
        enum: ['contacts', 'except', 'only'],
        default: 'contacts'
    },
    statusPrivacyExcluded: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    statusPrivacyIncluded: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    lastSeen: {
        type: Date,
        default: Date.now
    },
    // Social Media Fields
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    bio: { type: String, default: '' },
    website: { type: String, default: '' },
    postsCount: { type: Number, default: 0 },
    // Features
    archivedChats: [{ type: String }], // Can be UserID (for 1:1) or GroupID
    deletedChats: [{ type: String }],  // Chats hidden from main list
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});

module.exports = mongoose.model("User", UserSchema);
