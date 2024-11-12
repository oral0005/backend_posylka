// routes/users.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const twilio = require('twilio');

const User = require('../models/User');
const router = express.Router();

// Twilio client setup
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Temporary storage for verification codes (use a database or cache in production)
let phoneVerificationCodes = [];

// Function to send SMS
async function sendSMS(to, body) {
    try {
        await client.messages.create({
            body,
            from: process.env.TWILIO_PHONE_NUMBER,
            to,
        });
    } catch (err) {
        console.error('Failed to send SMS:', err.message);
        throw new Error('SMS sending failed');
    }
}

// Register User
router.post('/register', async (req, res) => {
    const { username, password, phoneNumber, name, surname } = req.body;

    // Simple validation
    if (!username || !password || !phoneNumber || !name || !surname) {
        return res.status(400).json({ msg: 'Please enter all required fields' });
    }

    try {
        // Check if username or phone number already exists
        let user = await User.findOne({ username });
        if (user) return res.status(400).json({ msg: 'Username already exists' });

        let phoneExists = await User.findOne({ phoneNumber });
        if (phoneExists) return res.status(400).json({ msg: 'Phone number already in use' });

        // Create new user
        user = new User({ username, password, phoneNumber, name, surname });

        // Hash password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);

        // Save user without setting isPhoneVerified to true
        await user.save();

        // Generate verification code
        const verificationCode = crypto.randomInt(100000, 999999).toString();

        // Store the code with the phone number and timestamp
        phoneVerificationCodes.push({
            phoneNumber,
            verificationCode,
            timestamp: Date.now(),
        });

        // Send SMS with the code
        await sendSMS(phoneNumber, `Your verification code is: ${verificationCode}`);

        res.status(200).json({ msg: 'Verification code sent to your phone number' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Verify Phone Number
router.post('/verify-phone', async (req, res) => {
    const { phoneNumber, verificationCode } = req.body;

    try {
        // Find the code in the temporary storage
        const codeEntry = phoneVerificationCodes.find(
            (entry) =>
                entry.phoneNumber === phoneNumber && entry.verificationCode === verificationCode
        );

        if (!codeEntry) {
            return res.status(400).json({ msg: 'Invalid verification code' });
        }

        // Check if the code has expired (valid for 10 minutes)
        const codeValidDuration = 10 * 60 * 1000; // 10 minutes in milliseconds
        if (Date.now() - codeEntry.timestamp > codeValidDuration) {
            return res.status(400).json({ msg: 'Verification code has expired' });
        }

        // Update user as verified
        await User.findOneAndUpdate({ phoneNumber }, { isPhoneVerified: true });

        // Remove the code from temporary storage
        phoneVerificationCodes = phoneVerificationCodes.filter(
            (entry) => entry.phoneNumber !== phoneNumber
        );

        res.status(200).json({ msg: 'Phone number verified successfully' });
    } catch (err) {
        console.error(err.message);
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

        // Check if phone is verified
        if (!user.isPhoneVerified) {
            return res.status(400).json({ msg: 'Phone number not verified' });
        }

        // Validate password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ msg: 'Invalid Credentials' });

        // Generate token
        const payload = { userId: user.id };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                name: user.name,
                surname: user.surname,
            },
        });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

module.exports = router;
