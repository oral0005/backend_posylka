// routes/senderPosts.js
const express = require('express');
const jwt = require('jsonwebtoken');
const SenderPost = require('../models/SenderPost');
const router = express.Router();

// Authentication middleware
function authenticateToken(req, res, next) {
    const token = req.headers['x-auth-token'];
    if (!token) return res.status(401).json({ msg: 'No token, authorization denied' });

    jwt.verify(token, 'your_jwt_secret', (err, user) => {
        if (err) return res.status(401).json({ msg: 'Token is not valid' });
        req.user = user;
        next();
    });
}

// Create a Sender Post
router.post('/', authenticateToken, async (req, res) => {
    const { route, sendTime, parcelPrice, phoneNumber, description } = req.body;

    try {
        const newPost = new SenderPost({
            userId: req.user.userId,
            route,
            sendTime,
            parcelPrice,
            phoneNumber,
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
        const posts = await SenderPost.find().populate('userId', 'username');
        res.json(posts);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// Update a Sender Post
router.put('/:id', authenticateToken, async (req, res) => {
    const { route, sendTime, parcelPrice, phoneNumber, description } = req.body;

    try {
        let post = await SenderPost.findById(req.params.id);
        if (!post) return res.status(404).json({ msg: 'Post not found' });

        if (post.userId.toString() !== req.user.userId)
            return res.status(401).json({ msg: 'Not authorized' });

        // Update fields
        post.route = route || post.route;
        post.sendTime = sendTime || post.sendTime;
        post.parcelPrice = parcelPrice || post.parcelPrice;
        post.phoneNumber = phoneNumber || post.phoneNumber;
        post.description = description || post.description;

        post = await post.save();
        res.json(post);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// Delete a Sender Post
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        let post = await SenderPost.findById(req.params.id);
        if (!post) return res.status(404).json({ msg: 'Post not found' });

        if (post.userId.toString() !== req.user.userId)
            return res.status(401).json({ msg: 'Not authorized' });

        await SenderPost.findByIdAndRemove(req.params.id);
        res.json({ msg: 'Post removed' });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

module.exports = router;
