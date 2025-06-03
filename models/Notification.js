const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    postId: { type: mongoose.Schema.Types.ObjectId, required: true },
    postType: { type: String, enum: ['sender', 'courier'], required: true },
    type: { type: String, enum: ['activation_request', 'accepted', 'rejected', 'completed'], required: true },
    message: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    read: { type: Boolean, default: false }
});

module.exports = mongoose.model('Notification', NotificationSchema);