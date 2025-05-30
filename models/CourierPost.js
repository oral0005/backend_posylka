const mongoose = require('mongoose');

const CourierPostSchema = new mongoose.Schema({
    userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    from:            { type: String, required: true },
    to:              { type: String, required: true },
    sendTime:   { type: Date, required: true },
    pricePerParcel:  { type: Number, required: true },
    description:     { type: String },
    dateCreated:     { type: Date, default: Date.now },
});

module.exports = mongoose.model('CourierPost', CourierPostSchema);
