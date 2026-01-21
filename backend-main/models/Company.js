const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
    companyName: {
        type: String,
        required: true
    },
    contactNumber: {
        type: String,
        required: false
    },
    companyId: {
        type: String,
        required: true,
        unique: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
});

module.exports = mongoose.model('Company', companySchema);
