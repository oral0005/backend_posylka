const mongoose = require('mongoose');

const SenderPostSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    from: { type: String, required: true },
    to: { type: String, required: true },
    sendTime: { type: Date, required: true },
    parcelPrice: { type: Number, required: true },
    description: { type: String },
    dateCreated: { type: Date, default: Date.now },
    status: { type: String, enum: ['open', 'active', 'completed'], default: 'open' }, // Tracks post status
    assignedCourier: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // Assigned courier
    assignedSender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // Assigned sender
    completedByCourier: { type: Boolean, default: false }, // Courier marked as completed
    confirmedBySender: { type: Boolean, default: false } // Sender confirmed completion
});

module.exports = mongoose.model('SenderPost', SenderPostSchema);