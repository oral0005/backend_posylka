const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const CourierPost = require('../models/CourierPost');
const User = require('../models/User');
const Notification = require('../models/Notification');
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

// Get All Courier Posts (only open posts)
router.get('/', async (req, res) => {
    try {
        const posts = await CourierPost.find({ status: 'open' }).populate(
            'userId',
            'username phoneNumber name surname'
        );
        res.json(posts);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Get Current User's Courier Posts (including active and completed)
router.get('/my-posts', authenticateToken, async (req, res) => {
    try {
        const posts = await CourierPost.find({ userId: req.user.id }).populate(
            'userId assignedSender',
            'username phoneNumber name surname'
        );
        res.json(posts);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Get Active Courier Posts for User (as courier or sender)
router.get('/active', authenticateToken, async (req, res) => {
    try {
        const posts = await CourierPost.find({
            $or: [
                { userId: req.user.id, status: 'active' },
                { assignedSender: req.user.id, status: 'active' }
            ]
        }).populate('userId assignedSender', 'username phoneNumber name surname');
        res.json(posts);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// Get Completed Courier Posts for User (as courier or sender)
router.get('/completed', authenticateToken, async (req, res) => {
    try {
        const posts = await CourierPost.find({
            $or: [
                { userId: req.user.id, status: 'completed' },
                { assignedSender: req.user.id, status: 'completed' }
            ]
        }).populate('userId assignedSender', 'username phoneNumber name surname');
        res.json(posts);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// Activate a Courier Post
router.post('/:id/activate', authenticateToken, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ msg: 'Invalid post ID' });
        }

        const post = await CourierPost.findById(req.params.id);
        if (!post) return res.status(404).json({ msg: 'Post not found' });
        if (post.status !== 'open') return res.status(400).json({ msg: 'Post is not open for activation' });
        if (post.userId.toString() === req.user.id) return res.status(400).json({ msg: 'Cannot activate your own post' });

        const notification = new Notification({
            recipientId: post.userId,
            senderId: req.user.id,
            postId: post._id,
            postType: 'courier',
            type: 'activation_request',
            message: `User ${req.user.username} wants to activate your courier post from ${post.from} to ${post.to}`
        });

        await notification.save();
        res.json({ msg: 'Activation request sent' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// Accept or Reject Activation Request
router.post('/:id/activation-response', authenticateToken, async (req, res) => {
    const { accept } = req.body; // true for accept, false for reject

    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ msg: 'Invalid post ID' });
        }

        const post = await CourierPost.findById(req.params.id);
        if (!post) return res.status(404).json({ msg: 'Post not found' });
        if (post.userId.toString() !== req.user.id) return res.status(401).json({ msg: 'Not authorized' });
        if (post.status !== 'open') return res.status(400).json({ msg: 'Post is not open' });

        const notification = await Notification.findOne({
            postId: post._id,
            postType: 'courier',
            type: 'activation_request',
            read: false
        }).sort({ createdAt: -1 });

        if (!notification) return res.status(404).json({ msg: 'No pending activation request found' });

        if (accept) {
            post.status = 'active';
            post.assignedSender = notification.senderId;
            await post.save();

            const acceptNotification = new Notification({
                recipientId: notification.senderId,
                senderId: req.user.id,
                postId: post._id,
                postType: 'courier',
                type: 'accepted',
                message: `Your activation request for courier post from ${post.from} to ${post.to} was accepted`
            });
            await acceptNotification.save();
            notification.read = true;
            await notification.save();

            res.json({ msg: 'Activation request accepted', post });
        } else {
            const rejectNotification = new Notification({
                recipientId: notification.senderId,
                senderId: req.user.id,
                postId: post._id,
                postType: 'courier',
                type: 'rejected',
                message: `Your activation request for courier post from ${post.from} to ${post.to} was rejected`
            });
            await rejectNotification.save();
            notification.read = true;
            await notification.save();

            res.json({ msg: 'Activation request rejected' });
        }
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// Mark Courier Post as Completed (by Courier)
router.post('/:id/complete', authenticateToken, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ msg: 'Invalid post ID' });
        }

        const post = await CourierPost.findById(req.params.id);
        if (!post) return res.status(404).json({ msg: 'Post not found' });
        if (post.userId.toString() !== req.user.id) return res.status(401).json({ msg: 'Not authorized' });
        if (post.status !== 'active') return res.status(400).json({ msg: 'Post is not active' });

        post.completedByCourier = true;
        await post.save();

        const notification = new Notification({
            recipientId: post.assignedSender,
            senderId: req.user.id,
            postId: post._id,
            postType: 'courier',
            type: 'completed',
            message: `Courier has marked the courier post from ${post.from} to ${post.to} as completed`
        });
        await notification.save();

        res.json({ msg: 'Post marked as completed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// Confirm Completion (by Sender)
router.post('/:id/confirm-completion', authenticateToken, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ msg: 'Invalid post ID' });
        }

        const post = await CourierPost.findById(req.params.id);
        if (!post) return res.status(404).json({ msg: 'Post not found' });
        if (post.assignedSender.toString() !== req.user.id) return res.status(401).json({ msg: 'Not authorized' });
        if (post.status !== 'active') return res.status(400).json({ msg: 'Post is not active' });
        if (!post.completedByCourier) return res.status(400).json({ msg: 'Courier has not marked post as completed' });

        post.confirmedBySender = true;
        post.status = 'completed';
        await post.save();

        const notification = new Notification({
            recipientId: post.userId,
            senderId: req.user.id,
            postId: post._id,
            postType: 'courier',
            type: 'completed',
            message: `Sender has confirmed completion of the courier post from ${post.from} to ${post.to}`
        });
        await notification.save();

        res.json({ msg: 'Completion confirmed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
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
        if (post.userId.toString() !== req.user.id) return res.status(401).json({ msg: 'Not authorized' });
        if (post.status !== 'open') return res.status(400).json({ msg: 'Cannot update active or completed post' });

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
        if (post.userId.toString() !== req.user.id) return res.status(401).json({ msg: 'Not authorized' });
        if (post.status !== 'open') return res.status(400).json({ msg: 'Cannot delete active or completed post' });

        await CourierPost.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Post removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;