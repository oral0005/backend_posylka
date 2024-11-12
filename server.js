// server.js
require('dotenv').config(); // Load environment variables
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Routes
const userRoutes = require('./routes/users');
const courierPostRoutes = require('./routes/courierPosts');
const senderPostRoutes = require('./routes/senderPosts');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/intercity-parcel', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

// Use Routes
app.use('/api/users', userRoutes);
app.use('/api/courier-posts', courierPostRoutes);
app.use('/api/sender-posts', senderPostRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
