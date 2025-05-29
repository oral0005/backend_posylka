// backend/routes/users.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');

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
    const { username, password, phoneNumber, name, surname } = req.body;

    if (!username || !password || !phoneNumber || !name || !surname) {
        return res.status(400).json({ msg: 'Please enter all required fields' });
    }

    try {
        let user = await User.findOne({ username });
        if (user) return res.status(400).json({ msg: 'Username already exists' });

        let phoneExists = await User.findOne({ phoneNumber });
        if (phoneExists) return res.status(400).json({ msg: 'Phone number already in use' });

        user = new User({ username, password, phoneNumber, name, surname });
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);
        await user.save();

        res.status(201).json({ msg: 'User registered successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
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

module.exports = router;