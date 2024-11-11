// models/SenderPost.js
const mongoose = require('mongoose');

const SenderPostSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    route: { type: String, required: true },
    sendTime: { type: Date, required: true },
    parcelPrice: { type: Number, required: true },
    phoneNumber: { type: String, required: true },
    description: { type: String },
    dateCreated: { type: Date, default: Date.now },
});

module.exports = mongoose.model('SenderPost', SenderPostSchema);
