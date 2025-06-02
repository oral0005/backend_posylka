const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const SenderPost = require('../models/SenderPost');
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

// Create a Sender Post
router.post('/', authenticateToken, async (req, res) => {
    const { from, to, sendTime, parcelPrice, description } = req.body;

    try {
        const newPost = new SenderPost({
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
        res.status(500).json({ msg: 'Server Error' });
    }
});

// Get All Sender Posts
router.get('/', async (req, res) => {
    try {
        const posts = await SenderPost.find().populate(
            'userId',
            'username phoneNumber name surname'
        ).populate('courierId', 'username phoneNumber name surname');
        res.json(posts);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// Get Current User's Sender Posts (includes posts where user is sender or assigned courier)
router.get('/my-posts', authenticateToken, async (req, res) => {
    try {
        const posts = await SenderPost.find({
            $or: [
                { userId: req.user.id }, 
                { courierId: req.user.id }
            ]
        }).populate('userId', 'username phoneNumber name surname')
          .populate('courierId', 'username phoneNumber name surname');
        res.json(posts);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Sender activates a post
router.post('/:id/activate', authenticateToken, async (req, res) => {
    try {
        const post = await SenderPost.findById(req.params.id);
        if (!post) return res.status(404).json({ msg: 'Post not found' });
        if (post.userId.toString() !== req.user.id) return res.status(401).json({ msg: 'Not authorized' });
        if (post.status !== 'pending') return res.status(400).json({ msg: 'Post cannot be activated' });

        post.status = 'pending_acceptance';
        await post.save();

        // Notify potential couriers (e.g., all users who are not the sender)
        // In a real app, you might have a more specific way to target couriers (e.g., based on location, preferences)
        const potentialCouriers = await User.find({ _id: { $ne: req.user.id }, /* Add courier role/flag here if available */ });
        const sender = req.user;

        for (const courier of potentialCouriers) {
            await Notification.create({
                recipient: courier._id,
                sender: sender._id,
                postId: post._id,
                postModel: 'SenderPost',
                type: 'post_activation_request',
                message: `A new delivery from ${post.from} to ${post.to} is available for acceptance.`
            });
        }

        res.json(post);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// Courier accepts a post
router.post('/:id/acceptByCourier', authenticateToken, async (req, res) => {
    try {
        const post = await SenderPost.findById(req.params.id);
        if (!post) return res.status(404).json({ msg: 'Post not found' });
        // Ensure the user accepting is not the sender
        if (post.userId.toString() === req.user.id) return res.status(401).json({ msg: 'Sender cannot accept their own post' });
        if (post.status !== 'pending_acceptance') return res.status(400).json({ msg: 'Post is not awaiting acceptance' });
        if (post.courierId) return res.status(400).json({ msg: 'Post already accepted by another courier' });

        post.status = 'active';
        post.courierId = req.user.id; // Assign current user as courier
        await post.save();

        // Notify the sender
        await Notification.create({
            recipient: post.userId,
            sender: req.user.id, // The courier who accepted
            postId: post._id,
            postModel: 'SenderPost',
            type: 'post_accepted',
            message: `Your post from ${post.from} to ${post.to} has been accepted by ${req.user.name}.`
        });

        res.json(post);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// Courier marks delivery as completed
router.post('/:id/markAsDeliveredByCourier', authenticateToken, async (req, res) => {
    try {
        const post = await SenderPost.findById(req.params.id);
        if (!post) return res.status(404).json({ msg: 'Post not found' });
        if (!post.courierId || post.courierId.toString() !== req.user.id) return res.status(401).json({ msg: 'Not authorized or not the assigned courier' });
        if (post.status !== 'active') return res.status(400).json({ msg: 'Post is not active' });

        post.status = 'pending_sender_confirmation';
        await post.save();

        // Notify the sender for confirmation
        await Notification.create({
            recipient: post.userId,
            sender: req.user.id, // The courier
            postId: post._id,
            postModel: 'SenderPost',
            type: 'delivery_completed_courier',
            message: `Courier ${req.user.name} has marked the delivery for your post from ${post.from} to ${post.to} as completed. Please confirm.`
        });

        res.json(post);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// Sender confirms completion
router.post('/:id/confirm-completion', authenticateToken, async (req, res) => {
    try {
        const post = await SenderPost.findById(req.params.id).populate('courierId', 'name');
        if (!post) return res.status(404).json({ msg: 'Post not found' });
        if (post.userId.toString() !== req.user.id) return res.status(401).json({ msg: 'Not authorized' });
        if (post.status !== 'pending_sender_confirmation') return res.status(400).json({ msg: 'Post is not awaiting sender confirmation' });

        post.status = 'completed';
        await post.save();

        // Notify sender and courier for rating
        await Notification.create({
            recipient: post.userId, // Sender
            sender: post.courierId?._id, // Courier (if exists)
            postId: post._id,
            postModel: 'SenderPost',
            type: 'rating_reminder',
            message: `Delivery confirmed for post ${post.from} to ${post.to}. Please rate your courier ${post.courierId?.name || ''}.`
        });

        if (post.courierId) {
            await Notification.create({
                recipient: post.courierId._id, // Courier
                sender: post.userId, // Sender
                postId: post._id,
                postModel: 'SenderPost',
                type: 'rating_reminder',
                message: `Delivery confirmed for post ${post.from} to ${post.to}. Please rate your sender.`
            });
        }

        res.json(post);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// Rate a user for a Sender Post
router.post('/:id/rate', authenticateToken, async (req, res) => {
    const { targetUserId, rating } = req.body; // targetUserId is the ID of the user being rated (sender or courier)
    const raterUserId = req.user.id; // The user who is submitting the rating

    try {
        const post = await SenderPost.findById(req.params.id);
        if (!post) return res.status(404).json({ msg: 'Post not found' });
        if (post.status !== 'completed') return res.status(400).json({ msg: 'Post must be completed to rate' });

        const userToRate = await User.findById(targetUserId);
        if (!userToRate) return res.status(404).json({ msg: 'User to rate not found' });

        // Determine if the rater is the sender or the courier for this post
        let isSenderRatingCourier = false;
        let isCourierRatingSender = false;

        if (post.userId.toString() === raterUserId && post.courierId && post.courierId.toString() === targetUserId) {
            isSenderRatingCourier = true;
        } else if (post.courierId && post.courierId.toString() === raterUserId && post.userId.toString() === targetUserId) {
            isCourierRatingSender = true;
        }

        if (!isSenderRatingCourier && !isCourierRatingSender) {
            return res.status(403).json({ msg: 'Rater is not part of this transaction or target user is incorrect' });
        }
        
        if (isSenderRatingCourier && post.senderRatedCourier) {
            return res.status(400).json({ msg: 'You have already rated the courier for this post' });
        }
        if (isCourierRatingSender && post.courierRatedSender) {
            return res.status(400).json({ msg: 'You have already rated the sender for this post' });
        }

        // Update user's average rating
        userToRate.rating = ((userToRate.rating * userToRate.numRatings) + rating) / (userToRate.numRatings + 1);
        userToRate.numRatings += 1;
        await userToRate.save();

        // Mark that rating has been done for this transaction direction
        if (isSenderRatingCourier) {
            post.senderRatedCourier = true;
        }
        if (isCourierRatingSender) {
            post.courierRatedSender = true;
        }
        await post.save();

        res.json({ msg: 'Rating submitted successfully', user: userToRate });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// Update a Sender Post (Generic update - careful with status changes here, use specific routes for that)
router.put('/:id', authenticateToken, async (req, res) => {
    const { from, to, sendTime, parcelPrice, description } = req.body;

    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ msg: 'Invalid post ID' });
        }

        let post = await SenderPost.findById(req.params.id);
        if (!post) return res.status(404).json({ msg: 'Post not found' });

        if (post.userId.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }
        // Prevent direct status update through this generic PUT, unless it's for cancellation by sender
        if (req.body.status && req.body.status !== 'cancelled' && post.status !== req.body.status) {
            return res.status(400).json({ msg: 'Status updates should be done through specific actions (activate, accept, etc.)' });
        }
        if (req.body.status === 'cancelled' && post.status !== 'pending' && post.status !== 'pending_acceptance'){
            return res.status(400).json({ msg: 'Post can only be cancelled if pending or pending_acceptance.' });
        }

        post.from = from || post.from;
        post.to = to || post.to;
        post.sendTime = sendTime || post.sendTime;
        post.parcelPrice = parcelPrice || post.parcelPrice;
        post.description = description || post.description;
        if(req.body.status === 'cancelled') post.status = 'cancelled';

        post = await post.save();
        res.json(post);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// Delete a Sender Post
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ msg: 'Invalid post ID' });
        }

        let post = await SenderPost.findById(req.params.id);
        if (!post) return res.status(404).json({ msg: 'Post not found' });

        if (post.userId.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }
        // Add any conditions for deletion, e.g., post must be in a certain status
        if (post.status === 'active' || post.status === 'completed') {
            return res.status(400).json({ msg: 'Cannot delete an active or completed post.'});
        }

        await SenderPost.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Post removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

module.exports = router;