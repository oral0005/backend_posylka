import json
import sys
from pymongo import MongoClient
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import LabelEncoder
from bson import ObjectId

# Custom JSON encoder to handle ObjectId
class MongoJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        return super().default(obj)

# Connect to MongoDB Atlas
print("Connecting to MongoDB Atlas...")
client = MongoClient('mongodb+srv://oralanykbajuly:oralkz.com@cluster0.4ndfquj.mongodb.net/intercity-parcel?retryWrites=true&w=majority')
db = client['intercity-parcel']
price_prediction_collection = db['priceprediction']
print("Connected to MongoDB Atlas")

# Mock distance matrix (in km, replace with real data or API in production)
cities = [
    'Almaty', 'Astana', 'Shymkent', 'Karaganda', 'Aktobe',
    'Taraz', 'Pavlodar', 'Ust-Kamenogorsk', 'Semey', 'Atyrau',
    'Kostanay', 'Kyzylorda', 'Uralsk', 'Petropavl', 'Aktau',
    'Temirtau', 'Turkestan', 'Taldykorgan', 'Ekibastuz', 'Rudny', 'Zhanaozen',
    'Zhezkazgan', 'Kentau', 'Balkhash', 'Satbayev', 'Kokshetau',
    'Saran', 'Shakhtinsk', 'Ridder', 'Arkalyk', 'Lisakovsk', 'Aral', 'Zhetisay',
    'Saryagash', 'Aksu', 'Stepnogorsk', 'Kapchagay'
]
print("Generating distance matrix...")
distance_matrix = {city1: {city2: 0 if city1 == city2 else int(100 + 900 * (abs(hash(city1 + city2)) % 1000) / 1000) for city2 in cities} for city1 in cities}
print("Distance matrix generated")

def get_distance(from_city, to_city):
    return distance_matrix.get(from_city, {}).get(to_city, 500)  # Default 500km if not found

def train_and_predict():
    # Fetch historical data from both senderposts and courierposts
    print("Fetching posts from MongoDB...")
    sender_data = list(db['senderposts'].find({}, {'from': 1, 'to': 1, 'parcelPrice': 1, '_id': 0}))
    courier_data = list(db['courierposts'].find({}, {'from': 1, 'to': 1, 'pricePerParcel': 1, '_id': 0}))
    print(f"Fetched {len(sender_data)} sender posts and {len(courier_data)} courier posts")

    if not sender_data and not courier_data:
        print("No data found for posts", file=sys.stderr)
        return []

    # Prepare combined DataFrame
    print("Preparing combined DataFrame...")
    sender_df = pd.DataFrame(sender_data).rename(columns={'parcelPrice': 'price'})
    courier_df = pd.DataFrame(courier_data).rename(columns={'pricePerParcel': 'price'})
    df = pd.concat([sender_df, courier_df], ignore_index=True)
    df['distance'] = df.apply(lambda row: get_distance(row['from'], row['to']), axis=1)
    print("DataFrame prepared")

    # Encode categorical variables
    print("Encoding categorical variables...")
    le_from = LabelEncoder()
    le_to = LabelEncoder()
    df['from_encoded'] = le_from.fit_transform(df['from'])
    df['to_encoded'] = le_to.fit_transform(df['to'])
    print("Categorical variables encoded")

    # Features and target
    X = df[['from_encoded', 'to_encoded', 'distance']]
    y = df['price']

    # Train Random Forest model
    print("Training Random Forest model...")
    model = RandomForestRegressor(n_estimators=50, random_state=42)
    model.fit(X, y)
    print("Model trained")

    # Get unique routes
    print("Extracting unique routes...")
    routes = df[['from', 'to']].drop_duplicates().to_dict('records')
    print(f"Found {len(routes)} unique routes")

    # Predict prices for each route
    predictions = []
    for i, route in enumerate(routes):
        from_city = route['from']
        to_city = route['to']
        distance = get_distance(from_city, to_city)
        from_encoded = le_from.transform([from_city])[0]
        to_encoded = le_to.transform([to_city])[0]
        features = [[from_encoded, to_encoded, distance]]
        predicted_price = model.predict(features)[0]
        print(f"Predicted price for route {i+1}/{len(routes)}: {from_city} to {to_city} = {predicted_price:.2f}")
        predictions.append({
            'from': from_city,
            'to': to_city,
            'recommendedPrice': max(round(predicted_price, -2), 50)  # Round to hundreds, minimum 50
        })

    return predictions

def main():
    # Generate predictions
    print("Generating predictions...")
    predictions = train_and_predict()
    print(f"Total predictions generated: {len(predictions)}")

    # Insert predictions into MongoDB priceprediction collection
    if predictions:
        print("Inserting predictions into MongoDB priceprediction collection...")
        price_prediction_collection.delete_many({})  # Clear existing data
        price_prediction_collection.insert_many(predictions)
        print(f"Inserted {len(predictions)} predictions into priceprediction collection")
    else:
        print("No predictions to insert into MongoDB", file=sys.stderr)

    # Output as JSON using custom encoder
    print("Outputting predictions as JSON...")
    print(json.dumps(predictions, cls=MongoJSONEncoder, indent=2))

if __name__ == '__main__':
    main()