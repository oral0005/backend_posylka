// routes/courierPosts.js
const express = require('express');
const jwt = require('jsonwebtoken');
const CourierPost = require('../models/CourierPost');
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

// Create a Courier Post
router.post('/', authenticateToken, async (req, res) => {
    const { route, departureTime, pricePerParcel, phoneNumber, description } = req.body;

    try {
        const newPost = new CourierPost({
            userId: req.user.userId,
            route,
            departureTime,
            pricePerParcel,
            phoneNumber,
            description,
        });

        const post = await newPost.save();
        res.json(post);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// Get All Courier Posts
router.get('/', async (req, res) => {
    try {
        const posts = await CourierPost.find().populate('userId', 'username');
        res.json(posts);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// Update a Courier Post
router.put('/:id', authenticateToken, async (req, res) => {
    const { route, departureTime, pricePerParcel, phoneNumber, description } = req.body;

    try {
        let post = await CourierPost.findById(req.params.id);
        if (!post) return res.status(404).json({ msg: 'Post not found' });

        if (post.userId.toString() !== req.user.userId)
            return res.status(401).json({ msg: 'Not authorized' });

        // Update fields
        post.route = route || post.route;
        post.departureTime = departureTime || post.departureTime;
        post.pricePerParcel = pricePerParcel || post.pricePerParcel;
        post.phoneNumber = phoneNumber || post.phoneNumber;
        post.description = description || post.description;

        post = await post.save();
        res.json(post);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// Delete a Courier Post
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        let post = await CourierPost.findById(req.params.id);
        if (!post) return res.status(404).json({ msg: 'Post not found' });

        if (post.userId.toString() !== req.user.userId)
            return res.status(401).json({ msg: 'Not authorized' });

        await CourierPost.findByIdAndRemove(req.params.id);
        res.json({ msg: 'Post removed' });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

module.exports = router;
