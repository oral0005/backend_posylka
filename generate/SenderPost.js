require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const axios = require('axios');
const { ObjectId } = mongoose.Types;

// Validate environment variables
if (!process.env.MONGO_URI) {
    console.error('Error: MONGO_URI is not defined in .env file');
    process.exit(1);
}
if (!process.env.API_KEY) {
    console.error('Error: API_KEY is not defined in .env file');
    process.exit(1);
}

// Connect to MongoDB Atlas
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .then(() => console.log('Connected to MongoDB Atlas'))
    .catch(err => {
        console.error('MongoDB Atlas connection error:', err);
        process.exit(1);
    });

const SenderPostSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    from: { type: String, required: true },
    to: { type: String, required: true },
    sendTime: { type: Date, required: true },
    parcelPrice: { type: Number, required: true },
    description: { type: String },
    dateCreated: { type: Date, default: Date.now },
});

const SenderPost = mongoose.model('SenderPost', SenderPostSchema);

const cities = [
    'Almaty', 'Astana', 'Shymkent', 'Karaganda', 'Aktobe',
    'Taraz', 'Pavlodar', 'Ust-Kamenogorsk', 'Semey', 'Atyrau',
    'Kostanay', 'Kyzylorda', 'Uralsk', 'Petropavl', 'Aktau',
    'Temirtau', 'Turkestan', 'Taldykorgan', 'Ekibastuz', 'Rudny', 'Zhanaozen',
    'Zhezkazgan', 'Kentau', 'Balkhash', 'Satbayev', 'Kokshetau',
    'Saran', 'Shakhtinsk', 'Ridder', 'Arkalyk', 'Lisakovsk', 'Aral', 'Zhetisay',
    'Saryagash', 'Aksu', 'Stepnogorsk', 'Kapchagay'
];

const keyRoutes = [
    { from: 'Astana', to: 'Shymkent' },
    { from: 'Almaty', to: 'Astana' },
];

const fallbackDistances = {
    'Almaty_Astana': 1200,
    'Astana_Shymkent': 1265,
    'Almaty_Shymkent': 700,
    'Karaganda_Astana': 200,
    'Aktobe_Atyrau': 550,
    'Almaty_Karaganda': 800,
    'Shymkent_Taraz': 150,
};

const distanceCache = {};

const API_KEY = process.env.API_KEY;

async function fetchDistance(from, to, retries = 3, delay = 1000) {
    const key = `${from}_${to}`;
    const reverseKey = `${to}_${from}`;

    if (distanceCache[key] || distanceCache[reverseKey]) {
        return distanceCache[key] || distanceCache[reverseKey];
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await axios.get('https://api-v2.distancematrix.ai/maps/api/distancematrix/json', {
                params: {
                    origins: `${from},Kazakhstan`,
                    destinations: `${to},Kazakhstan`,
                    mode: 'driving',
                    key: API_KEY,
                },
                timeout: 5000,
            });

            const element = response.data.rows[0].elements[0];
            if (element.status === 'OK') {
                const distanceKm = element.distance.value / 1000;
                distanceCache[key] = distanceKm;
                distanceCache[reverseKey] = distanceKm;
                return distanceKm;
            } else {
                console.warn(`API error for ${from} to ${to}: ${element.status}`);
            }
        } catch (err) {
            if (attempt < retries) {
                console.warn(`Attempt ${attempt} failed for ${from} to ${to}: ${err.message}. Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                console.error(`Error fetching distance for ${from} to ${to} after ${retries} attempts: ${err.message}`);
            }
        }
    }

    const fallback = fallbackDistances[key] || fallbackDistances[reverseKey] || 500;
    distanceCache[key] = fallback;
    distanceCache[reverseKey] = fallback;
    console.log(`Using fallback distance ${fallback} km for ${from} to ${to}`);
    return fallback;
}

function calculatePrice(distance, sendTime) {
    const basePrice = 2000;
    const pricePerKm = 2;
    let price = basePrice + distance * pricePerKm;

    const variation = 0.3;
    const randomFactor = 1 + (Math.random() * 2 - 1) * variation;
    price *= randomFactor;

    const startDate = new Date('2025-01-10');
    const daysSinceStart = (sendTime - startDate) / (1000 * 60 * 60 * 24);
    price *= (1 + 0.001 * daysSinceStart);

    price = Math.min(Math.round(price / 100) * 100, 8000);
    return Math.max(price, 2000);
}

function randomDate(start, end) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function randomDescription() {
    const descriptions = [
        'Urgent parcel delivery',
        'Fragile items, handle with care',
        'Small package, quick delivery',
        'Documents, need by tomorrow',
        '',
    ];
    return descriptions[Math.floor(Math.random() * descriptions.length)];
}

function randomCityPair(useKeyRoute) {
    if (useKeyRoute && Math.random() < 0.7) {
        return keyRoutes[Math.floor(Math.random() * keyRoutes.length)];
    }
    const from = cities[Math.floor(Math.random() * cities.length)];
    let to = cities[Math.floor(Math.random() * cities.length)];
    while (to === from) to = cities[Math.floor(Math.random() * cities.length)];
    return { from, to };
}

async function generateTrainingData() {
    const posts = [];
    const startDate = new Date('2025-05-20');
    const endDate = new Date('2025-06-10');

    const userIds = [
        new ObjectId('507f1f77bcf86cd799439011'),
        new ObjectId('507f1f77bcf86cd799439012'),
        new ObjectId('507f1f77bcf86cd799439013'),
    ];

    for (let i = 0; i < 200; i++) {
        const useKeyRoute = i < 120;
        const { from, to } = randomCityPair(useKeyRoute);
        const sendTime = randomDate(startDate, endDate);
        const distance = await fetchDistance(from, to);
        const price = calculatePrice(distance, sendTime);
        posts.push({
            userId: userIds[Math.floor(Math.random() * userIds.length)],
            from,
            to,
            sendTime,
            parcelPrice: price,
            description: randomDescription(),
            dateCreated: new Date(),
        });
    }

    try {
        await SenderPost.deleteMany({});
        await SenderPost.insertMany(posts);
        console.log('Successfully inserted 200 SenderPosts for ML training');
        console.log('Distance cache:', distanceCache);
    } catch (err) {
        console.error('Error inserting posts:', err);
        process.exit(1);
    } finally {
        mongoose.connection.close();
    }
}

generateTrainingData();