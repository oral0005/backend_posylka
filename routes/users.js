// backend/routes/users.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');

const User = require('../models/User');
const router = express.Router();

// Настройка multer для загрузки аватаров
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Папка для сохранения изображений, создай её если нет
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Максимум 5MB
  fileFilter: (req, file, cb) => {
    console.log('UPLOAD FILE:', file.originalname, file.mimetype, path.extname(file.originalname));
    const allowedTypes = /jpeg|jpg|png|webp|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype.toLowerCase());
    if (extname || mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed (jpeg, jpg, png, webp, gif)'));
    }
  }
});

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

// Register User
router.post('/register', async (req, res) => {
  try {
    const { username, password, phoneNumber, name, surname } = req.body;

    // Проверяем, существует ли пользователь
    let user = await User.findOne({ username });
    if (user) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    // Проверяем, существует ли номер телефона
    user = await User.findOne({ phoneNumber });
    if (user) {
      return res.status(400).json({ message: 'Phone number already registered' });
    }

    // Хешируем пароль
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Создаем нового пользователя
    user = new User({
      username,
      password: hashedPassword,
      phoneNumber,
      name,
      surname,
      isVerified: false
    });

    await user.save();

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// Login User
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    let user = await User.findOne({ username });
    if (!user) return res.status(400).json({ msg: 'Invalid Credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'Invalid Credentials' });

    const payload = { userId: user.id };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        surname: user.surname,
        avatarUrl: user.avatarUrl || null,
        language: user.language || 'en',
      },
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Get Current User Profile
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ msg: 'User not found' });

    res.json({
      id: user.id,
      username: user.username,
      phoneNumber: user.phoneNumber,
      name: user.name,
      surname: user.surname,
      avatarUrl: user.avatarUrl || null,
      language: user.language || 'en',
      isVerified: user.isVerified,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Update user profile with optional avatar upload
router.put('/me', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    if (req.body.name) user.name = req.body.name;
    if (req.body.surname) user.surname = req.body.surname;
    if (req.body.language) user.language = req.body.language;

    if (req.file) {
      user.avatarUrl = `/uploads/${req.file.filename}`;
    }
    if (req.body.avatarUrl) {
      user.avatarUrl = req.body.avatarUrl.replace(/^https?:\/\/[^/]+/, '');
    }

    await user.save();

    res.json({
      id: user.id,
      username: user.username,
      phoneNumber: user.phoneNumber,
      name: user.name,
      surname: user.surname,
      avatarUrl: user.avatarUrl || null,
      language: user.language || 'en',
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Эндпоинт для загрузки аватара
router.post('/upload-avatar', upload.single('avatar'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const avatarUrl = `/uploads/${req.file.filename}`;
  res.json({ avatarUrl });
});

// Change password
router.put('/change-password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ msg: 'Please fill in all fields' });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ msg: 'New passwords do not match' });
  }
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'Current password is incorrect' });
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();
    res.json({ msg: 'Password changed successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

module.exports = router;
