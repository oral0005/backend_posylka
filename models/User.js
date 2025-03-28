// backend/models/User.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username:    { type: String, required: true, unique: true },
    password:    { type: String, required: true },
    phoneNumber: { type: String, required: true, unique: true },
    name:        { type: String, required: true },
    surname:     { type: String, required: true },
});

module.exports = mongoose.model('User', UserSchema);
