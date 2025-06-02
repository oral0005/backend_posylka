const mongoose = require('mongoose');
//

const NotificationSchema = new mongoose.Schema({
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Optional: Who initiated the notification
    postId: { type: mongoose.Schema.Types.ObjectId, refPath: 'postModel' }, // To link to either SenderPost or CourierPost
    postModel: { type: String, enum: ['SenderPost', 'CourierPost'] }, // To specify which model postId refers to
    type: { 
        type: String, 
        enum: ['post_activation_request', 'post_accepted', 'delivery_completed_courier', 'delivery_confirmed_sender', 'rating_reminder'], 
        required: true 
    },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Notification', NotificationSchema); 