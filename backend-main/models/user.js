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
    }
});

module.exports = mongoose.model("User", UserSchema);
