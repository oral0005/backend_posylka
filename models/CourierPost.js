// models/CourierPost.js
const mongoose = require('mongoose');

const CourierPostSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    route: { type: String, required: true },
    departureTime: { type: Date, required: true },
    pricePerParcel: { type: Number, required: true },
    phoneNumber: { type: String, required: true },
    description: { type: String },
    dateCreated: { type: Date, default: Date.now },
});

module.exports = mongoose.model('CourierPost', CourierPostSchema);
