const mongoose = require('mongoose');

const PricePredictionSchema = new mongoose.Schema({
    from: String,
    to: String,
    postType: String,
    recommendedPrice: Number,
});

// Указываем явно имя коллекции
module.exports = mongoose.model('PricePrediction', PricePredictionSchema, 'priceprediction');
