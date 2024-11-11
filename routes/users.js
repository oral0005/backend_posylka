// routes/users.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const router = express.Router();

// Register User
router.post('/register', async (req, res) => {
    const { username, password } = req.body;

    try {
        // Check if user exists
        let user = await User.findOne({ username });
        if (user) return res.status(400).json({ msg: 'User already exists' });

        // Create new user
        user = new User({ username, password });

        // Hash password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);

        await user.save();

        // Generate token
        const payload = { userId: user.id };
        const token = jwt.sign(payload, 'your_jwt_secret', { expiresIn: 3600 });
        res.json({ token });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// Login User
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        // Check for user
        let user = await User.findOne({ username });
        if (!user) return res.status(400).json({ msg: 'Invalid Credentials' });

        // Validate password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ msg: 'Invalid Credentials' });

        // Generate token
        const payload = { userId: user.id };
        const token = jwt.sign(payload, 'your_jwt_secret', { expiresIn: 3600 });
        res.json({ token });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

module.exports = router;
