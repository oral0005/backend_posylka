const express = require('express');
const PricePrediction = require('../models/PricePrediction');
const router = express.Router();

router.get('/recommended-price', async (req, res) => {
    let { from, to } = req.query;

    if (!from || !to) {
        return res.status(400).json({ msg: 'Missing required query parameters: from, to' });
    }

    // Удаляем пробелы по краям
    from = from.trim();
    to = to.trim();

    try {
        console.log('Searching price for route:', { from, to });

        // Пытаемся найти в прямом направлении
        let prediction = await PricePrediction.findOne({
            from: { $regex: `^${from}$`, $options: 'i' },
            to: { $regex: `^${to}$`, $options: 'i' },
        });

        // Если не нашли — ищем в обратном направлении
        if (!prediction) {
            console.log('Trying reversed direction...');
            prediction = await PricePrediction.findOne({
                from: { $regex: `^${to}$`, $options: 'i' },
                to: { $regex: `^${from}$`, $options: 'i' },
            });
        }



        console.log(`Found prediction: ${prediction.recommendedPrice}`);
        res.json({ recommendedPrice: prediction.recommendedPrice });
    } catch (err) {
        console.error('Server error:', err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

module.exports = router;
