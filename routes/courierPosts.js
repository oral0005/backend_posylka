const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const CourierPost = require('../models/CourierPost');
const User = require('../models/User');
const router = express.Router();

// Authentication middleware
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

// Create a Courier Post
router.post('/', authenticateToken, async (req, res) => {
    const { from, to, sendTime, parcelPrice, description } = req.body;

    try {
        const newPost = new CourierPost({
            userId: req.user.id,
            from,
            to,
            sendTime,
            parcelPrice,
            description,
        });

        const post = await newPost.save();
        res.json(post);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Get All Courier Posts
router.get('/', async (req, res) => {
    try {
        const posts = await CourierPost.find().populate(
            'userId',
            'username phoneNumber name surname'
        );
        res.json(posts);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Get Current User's Courier Posts
router.get('/my-posts', authenticateToken, async (req, res) => {
    try {
        const posts = await CourierPost.find({ userId: req.user.id }).populate(
            'userId',
            'username phoneNumber name surname'
        );
        res.json(posts);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Update a Courier Post
router.put('/:id', authenticateToken, async (req, res) => {
    const { from, to, sendTime, parcelPrice, description } = req.body;

    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ msg: 'Invalid post ID' });
        }

        let post = await CourierPost.findById(req.params.id);
        if (!post) return res.status(404).json({ msg: 'Post not found' });

        if (post.userId.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        post.from = from || post.from;
        post.to = to || post.to;
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

// Delete a Courier Post
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ msg: 'Invalid post ID' });
        }

        let post = await CourierPost.findById(req.params.id);
        if (!post) return res.status(404).json({ msg: 'Post not found' });

        if (post.userId.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        await CourierPost.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Post removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;