// backend/models/CourierPost.js
const mongoose = require('mongoose');

const CourierPostSchema = new mongoose.Schema({
    userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    from:            { type: String, required: true }, // Новое поле "from"
    to:              { type: String, required: true }, // Новое поле "to"
    departureTime:   { type: Date, required: true },
    pricePerParcel:  { type: Number, required: true },
    description:     { type: String },
    dateCreated:     { type: Date, default: Date.now },
});

module.exports = mongoose.model('CourierPost', CourierPostSchema);
