const express = require('express');
const router = express.Router();
const { sendVerificationCode, checkVerificationCode } = require('../services/smsService');
const User = require('../models/User');

// Отправка кода верификации
router.post('/send-verification', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ message: 'Phone number is required' });
    }
    const user = await User.findOne({ phoneNumber });
    if (!user) {
      return res.status(404).json({ message: 'User not found with this phone number' });
    }
    const result = await sendVerificationCode(phoneNumber);
    res.json({ message: 'Verification code sent successfully', sid: result.sid });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to send verification code' });
  }
});

// Проверка кода верификации
router.post('/verify-code', async (req, res) => {
  try {
    const { phoneNumber, code } = req.body;
    if (!phoneNumber || !code) {
      return res.status(400).json({ message: 'Phone number and code are required' });
    }
    const user = await User.findOne({ phoneNumber });
    if (!user) {
      return res.status(404).json({ message: 'User not found with this phone number' });
    }
    const verificationResult = await checkVerificationCode(phoneNumber, code);
    if (!verificationResult.success) {
      return res.status(400).json({ message: 'Invalid verification code', status: verificationResult.status });
    }
    user.isVerified = true;
    await user.save();
    res.json({ message: 'Phone number verified successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to verify code' });
  }
});

module.exports = router;