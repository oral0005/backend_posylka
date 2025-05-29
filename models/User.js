const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username:    { type: String, required: true, unique: true, trim: true },
    password:    { type: String, required: true },
    phoneNumber: { type: String, required: true, unique: true, trim: true },
    name:        { type: String, required: true, trim: true },
    surname:     { type: String, required: true, trim: true },
    avatarUrl:   { type: String, default: null },
    language:    { type: String, enum: ['en', 'ru', 'kk'], default: 'en' },
    isVerified:  { type: Boolean, default: false },
    createdAt:   { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
