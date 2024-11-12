// routes/senderPosts.js
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const SenderPost = require('../models/SenderPost');
const User = require('../models/User');
const router = express.Router();

// Authentication middleware
async function authenticateToken(req, res, next) {
    const token = req.headers['x-auth-token'];
    if (!token) return res.status(401).json({ msg: 'No token, authorization denied' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Fetch user from DB
        const user = await User.findById(decoded.userId);
        if (!user) return res.status(401).json({ msg: 'User not found' });

        // Check if phone is verified
        if (!user.isPhoneVerified) {
            return res.status(401).json({ msg: 'Phone number not verified' });
        }

        req.user = user; // Attach the full user object
        next();
    } catch (err) {
        res.status(401).json({ msg: 'Token is not valid' });
    }
}

// Create a Sender Post
router.post('/', authenticateToken, async (req, res) => {
    const { route, sendTime, parcelPrice, description } = req.body;

    try {
        const newPost = new SenderPost({
            userId: req.user.id,
            route,
            sendTime,
            parcelPrice,
            description,
        });

        const post = await newPost.save();
        res.json(post);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// Get All Sender Posts
router.get('/', async (req, res) => {
    try {
        const posts = await SenderPost.find().populate(
            'userId',
            'username phoneNumber name surname'
        );
        res.json(posts);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// Update a Sender Post
router.put('/:id', authenticateToken, async (req, res) => {
    const { route, sendTime, parcelPrice, description } = req.body;

    try {
        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ msg: 'Invalid post ID' });
        }

        let post = await SenderPost.findById(req.params.id);
        if (!post) return res.status(404).json({ msg: 'Post not found' });

        if (post.userId.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        // Update fields
        post.route = route || post.route;
        post.sendTime = sendTime || post.sendTime;
        post.parcelPrice = parcelPrice || post.parcelPrice;
        post.description = description || post.description;

        post = await post.save();
        res.json(post);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Delete a Sender Post
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ msg: 'Invalid post ID' });
        }

        let post = await SenderPost.findById(req.params.id);

        if (!post) {
            return res.status(404).json({ msg: 'Post not found' });
        }

        if (post.userId.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        await SenderPost.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Post removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
