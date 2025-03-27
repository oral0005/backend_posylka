// backend/models/SenderPost.js
const mongoose = require('mongoose');

const SenderPostSchema = new mongoose.Schema({
    userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    from:        { type: String, required: true }, // Новое поле "from"
    to:          { type: String, required: true }, // Новое поле "to"
    sendTime:    { type: Date, required: true },
    parcelPrice: { type: Number, required: true },
    description: { type: String },
    dateCreated: { type: Date, default: Date.now },
});

module.exports = mongoose.model('SenderPost', SenderPostSchema);
