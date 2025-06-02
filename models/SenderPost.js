const mongoose = require('mongoose');

const SenderPostSchema = new mongoose.Schema({
    userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    courierId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    from:        { type: String, required: true },
    to:          { type: String, required: true },
    sendTime:    { type: Date, required: true },
    parcelPrice: { type: Number, required: true },
    description: { type: String },
    status: {
        type: String,
        enum: ['pending', 'pending_acceptance', 'active', 'pending_sender_confirmation', 'completed', 'cancelled'],
        default: 'pending'
    },
    dateCreated: { type: Date, default: Date.now },
    senderRatedCourier: { type: Boolean, default: false },
    courierRatedSender: { type: Boolean, default: false },
});

module.exports = mongoose.model('SenderPost', SenderPostSchema);
