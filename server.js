require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Routes
const userRoutes = require('./routes/users');
const courierPostRoutes = require('./routes/courierPosts');
const senderPostRoutes = require('./routes/senderPosts');
const pricePredictionRoutes = require('./routes/pricePredictions');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/intercity-parcel')
    .then(() => console.log('Connected to MongoDB'))
    .catch((err) => console.error('Failed to connect to MongoDB', err));

// Use Routes
app.use('/api/users', userRoutes);
app.use('/api/courier-posts', courierPostRoutes);
app.use('/api/sender-posts', senderPostRoutes);
app.use('/api/price-predictions', pricePredictionRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server started on port: http://localhost:${PORT}`));