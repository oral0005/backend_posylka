const express = require('express');
const router = express.Router();
//
const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const User = require('../models/User'); // Assuming User model is in ../models/User
const jwt = require('jsonwebtoken');

// Authentication middleware (similar to other route files)
async function authenticateToken(req, res, next) {
    const token = req.headers['x-auth-token'];
    if (!token) return res.status(401).json({ msg: 'No token, authorization denied' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        if (!user) return res.status(401).json({ msg: 'User not found' });
        req.user = user;
        next();
    } catch (err) {
        res.status(401).json({ msg: 'Token is not valid' });
    }
}

// Get notifications for the logged-in user
router.get('/', authenticateToken, async (req, res) => {
    try {
        const notifications = await Notification.find({ recipient: req.user.id })
            .populate('sender', 'name surname avatarUrl') // Populate sender details
            .sort({ createdAt: -1 });
        res.json(notifications);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// Mark a notification as read
router.put('/:id/read', authenticateToken, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ msg: 'Invalid notification ID' });
        }
        const notification = await Notification.findById(req.params.id);

        if (!notification) {
            return res.status(404).json({ msg: 'Notification not found' });
        }

        // Ensure the notification belongs to the user
        if (notification.recipient.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        notification.isRead = true;
        await notification.save();
        res.json(notification);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// Mark all unread notifications as read for the logged-in user
router.put('/mark-all-read', authenticateToken, async (req, res) => {
    try {
        await Notification.updateMany(
            { recipient: req.user.id, isRead: false },
            { $set: { isRead: true } }
        );
        res.json({ msg: 'All notifications marked as read' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

module.exports = router; //ggf