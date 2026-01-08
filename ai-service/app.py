import joblib
import pandas as pd
from flask import Flask, request, jsonify

app = Flask(__name__)

try:
    model = joblib.load('model.joblib')
    print("Model loaded successfully.")
except Exception as e:
    print(f"Error loading model: {e}")
    model = None

@app.route('/predict', methods=['POST'])
def predict():
    if model is None:
        return jsonify({'error': 'Model is not loaded.'}), 500

    data = request.get_json()
    if data is None:
        return jsonify({'error': 'No JSON data provided.'}), 400

    try:
        df = pd.DataFrame([data])
        features = df[['temperature', 'vibration']]

    except Exception as e:
        return jsonify({'error': f'Invalid input data format: {str(e)}'}), 400

    try:
        prediction = model.predict(features)

        is_anomaly = True if prediction == -1 else False

        response = {'is_anomaly': is_anomaly}

        return jsonify(response)

    except Exception as e:
        return jsonify({'error': f'Error during prediction: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)