import json
import sys
from pymongo import MongoClient
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import LabelEncoder
from bson import ObjectId
import itertools
import logging
import math
from functools import lru_cache
import os

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Custom JSON encoder to handle ObjectId
class MongoJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        return super().default(obj)

# Connect to MongoDB Atlas
logging.info("Connecting to MongoDB Atlas...")
try:
    client = MongoClient(os.getenv('MONGODB_URI', 'mongodb+srv://oralanykbajuly:oralkz.com@cluster0.4ndfquj.mongodb.net/intercity-parcel?retryWrites=true&w=majority'))
    db = client['intercity-parcel']
    price_prediction_collection = db['priceprediction']
    logging.info("Connected to MongoDB Atlas")
except Exception as e:
    logging.error(f"Failed to connect to MongoDB: {e}")
    sys.exit(1)

# City coordinates (latitude, longitude) for Kazakhstan cities
city_coordinates = {
    'Almaty': [43.238949, 76.889709],
    'Astana': [51.169392, 71.449074],
    'Shymkent': [42.341683, 69.590101],
    'Karaganda': [49.804683, 73.109382],
    'Aktobe': [50.283933, 57.166978],
    'Taraz': [42.901533, 71.366662],
    'Pavlodar': [52.287303, 76.967402],
    'Ust-Kamenogorsk': [49.948059, 82.627816],
    'Semey': [50.411105, 80.227505],
    'Atyrau': [47.094496, 51.923837],
    'Kostanay': [53.219808, 63.635423],
    'Kyzylorda': [44.848831, 65.482269],
    'Uralsk': [51.233569, 51.366133],
    'Petropavl': [54.875301, 69.162742],
    'Aktau': [43.641071, 51.198259],
    'Temirtau': [50.059389, 72.966158],
    'Turkestan': [43.297333, 68.251750],
    'Taldykorgan': [45.015985, 78.397997],
    'Ekibastuz': [51.723713, 75.326615],
    'Rudny': [52.959221, 63.127697],
    'Zhanaozen': [43.337141, 52.855374],
    'Zhezkazgan': [47.804139, 67.706199],
    'Kentau': [43.518461, 68.510121],
    'Balkhash': [46.853208, 74.980462],
    'Satbayev': [47.900000, 67.533333],
    'Kokshetau': [53.287131, 69.404459],
    'Saran': [49.800000, 72.833333],
    'Shakhtinsk': [49.716667, 72.583333],
    'Ridder': [50.344135, 83.512896],
    'Arkalyk': [50.248611, 66.911389],
    'Lisakovsk': [52.536953, 62.493611],
    'Aral': [46.800000, 61.666667],
    'Zhetisay': [40.775833, 68.333333],
    'Saryagash': [41.450000, 69.166667],
    'Aksu': [52.033333, 76.916667],
    'Stepnogorsk': [51.150000, 71.883333],
    'Kapchagay': [43.866667, 77.066667]
}

@lru_cache(maxsize=1000)
def get_distance(city1, city2):
    # Haversine formula to calculate distance between two points
    try:
        lat1, lon1 = city_coordinates[city1]
        lat2, lon2 = city_coordinates[city2]

        # Convert to radians
        lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])

        # Haversine formula
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        R = 6371  # Earth's radius in km
        distance = R * c

        # Multiply by 1.4 to approximate road distance
        road_distance = distance * 1.4
        logging.info(f"Calculated distance for {city1} to {city2}: {road_distance:.2f} km")
        return road_distance
    except KeyError as e:
        logging.warning(f"Coordinates not found for {city1} or {city2}, using default 1200 km")
        return 1200

def normalize_route(from_city, to_city):
    # Return a sorted tuple to treat (A, B) and (B, A) as the same route
    return tuple(sorted([from_city, to_city]))

def get_existing_price(from_city, to_city):
    # Query priceprediction for existing routes (bidirectional)
    try:
        result = price_prediction_collection.find_one({
            '$or': [
                {'from': from_city, 'to': to_city},
                {'from': to_city, 'to': from_city}
            ]
        })
        if result and 'recommendedPrice' in result:
            logging.info(f"Found existing price for {from_city} to {to_city}: {result['recommendedPrice']}")
            return result['recommendedPrice']
        return None
    except Exception as e:
        logging.error(f"Error querying existing price for {from_city} to {to_city}: {e}")
        return None

def train_and_predict():
    # Fetch historical data from both senderposts and courierposts
    logging.info("Fetching posts from MongoDB...")
    try:
        sender_data = list(db['senderposts'].find({}, {'from': 1, 'to': 1, 'parcelPrice': 1, '_id': 0}))
        courier_data = list(db['courierposts'].find({}, {'from': 1, 'to': 1, 'pricePerParcel': 1, '_id': 0}))
        logging.info(f"Fetched {len(sender_data)} sender posts and {len(courier_data)} courier posts")
    except Exception as e:
        logging.error(f"Error fetching data from MongoDB: {e}")
        return []

    # Prepare combined DataFrame for training
    logging.info("Preparing training DataFrame...")
    sender_df = pd.DataFrame(sender_data).rename(columns={'parcelPrice': 'price'})
    courier_df = pd.DataFrame(courier_data).rename(columns={'pricePerParcel': 'price'})
    df = pd.concat([sender_df, courier_df], ignore_index=True)

    # Log rows with missing or invalid prices
    invalid_rows = df[df['price'].isna() | df['price'].isnull()]
    if not invalid_rows.empty:
        logging.warning(f"Found {len(invalid_rows)} rows with missing or invalid prices: {invalid_rows.to_dict('records')}")

    # Remove rows with NaN or non-numeric prices
    df = df.dropna(subset=['price'])
    df = df[pd.to_numeric(df['price'], errors='coerce').notnull()]
    df['price'] = df['price'].astype(float)

    # Normalize routes and calculate distances
    df['route'] = df.apply(lambda row: normalize_route(row['from'], row['to']), axis=1)
    df['distance'] = df.apply(lambda row: get_distance(row['from'], row['to']), axis=1)

    # Group by normalized route and take the minimum price
    logging.info("Grouping routes to select minimum prices...")
    df = df.groupby('route').agg({'price': 'min', 'distance': 'first', 'from': 'first', 'to': 'first'}).reset_index()
    logging.info(f"Reduced to {len(df)} unique routes with minimum prices")

    # If no valid data after cleaning, create a minimal dataset
    if df.empty:
        logging.warning("No valid data after cleaning, creating minimal dataset...")
        base_price = 2000
        price_per_km = 2
        distance = get_distance('Astana', 'Turkestan')
        formula_price = base_price + price_per_km * distance
        existing_price = get_existing_price('Astana', 'Turkestan')
        final_price = formula_price if existing_price is None else (existing_price + formula_price) / 2
        df = pd.DataFrame([
            {
                'route': normalize_route('Astana', 'Turkestan'),
                'from': 'Astana',
                'to': 'Turkestan',
                'price': max(5000, final_price),
                'distance': distance
            }
        ])

    # Encode categorical variables
    logging.info("Encoding categorical variables...")
    cities = list(city_coordinates.keys())
    le_from = LabelEncoder().fit(cities)
    le_to = LabelEncoder().fit(cities)
    df['from_encoded'] = le_from.transform(df['from'])
    df['to_encoded'] = le_to.transform(df['to'])
    logging.info("Categorical variables encoded")

    # Features and target
    X = df[['from_encoded', 'to_encoded', 'distance']]
    y = df['price']

    # Train Random Forest model
    logging.info("Training Random Forest model...")
    try:
        model = RandomForestRegressor(n_estimators=50, random_state=42)
        model.fit(X, y)
        logging.info("Model trained")
    except Exception as e:
        logging.error(f"Error training model: {e}")
        return []

    # Generate all possible undirected routes
    logging.info("Generating all possible undirected routes...")
    all_routes = list(itertools.combinations(cities, 2))
    logging.info(f"Generated {len(all_routes)} unique routes")

    # Predict prices for all routes
    predictions = []
    base_price = 2000
    price_per_km = 2
    for i, (from_city, to_city) in enumerate(all_routes):
        distance = get_distance(from_city, to_city)
        from_encoded = le_from.transform([from_city])[0]
        to_encoded = le_to.transform([to_city])[0]
        features = [[from_encoded, to_encoded, distance]]
        try:
            predicted_price = model.predict(features)[0]
            # Calculate formula price
            formula_price = base_price + price_per_km * distance
            # Get existing price from priceprediction
            existing_price = get_existing_price(from_city, to_city)
            # Compute final price
            if existing_price is not None:
                final_price = (existing_price + formula_price) / 2
                logging.info(f"Averaged price for {from_city} to {to_city}: existing={existing_price}, formula={formula_price}, avg={final_price:.2f}")
            else:
                final_price = formula_price
                logging.info(f"Used formula price for {from_city} to {to_city}: {final_price:.2f}")
            # Ensure minimum price and Astana-Turkestan rule
            min_price = max(predicted_price, formula_price)
            if (from_city, to_city) in [('Astana', 'Turkestan'), ('Turkestan', 'Astana')]:
                min_price = max(min_price, 5000)
            final_price = max(final_price, min_price)
            predictions.append({
                'from': from_city,
                'to': to_city,
                'recommendedPrice': max(round(final_price, -2), 50),
                'distance': round(distance, 2),
                'note': f"Price applies to both {from_city} to {to_city} and {to_city} to {from_city}"
            })
        except Exception as e:
            logging.error(f"Error predicting for route {from_city} to {to_city}: {e}")

    return predictions

def main():
    # Generate predictions
    logging.info("Generating predictions...")
    predictions = train_and_predict()
    logging.info(f"Total predictions generated: {len(predictions)}")

    # Insert predictions into MongoDB priceprediction collection
    if predictions:
        logging.info("Inserting predictions into MongoDB priceprediction collection...")
        try:
            price_prediction_collection.delete_many({})
            price_prediction_collection.insert_many(predictions)
            logging.info(f"Inserted {len(predictions)} predictions into priceprediction collection")
        except Exception as e:
            logging.error(f"Error inserting predictions into MongoDB: {e}")
    else:
        logging.error("No predictions to insert into MongoDB")

    # Output as JSON using custom encoder
    logging.info("Outputting predictions as JSON...")
    print(json.dumps(predictions, cls=MongoJSONEncoder, indent=2))

if __name__ == '__main__':
    main()