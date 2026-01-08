from flask import Flask, request, jsonify
import torch
import numpy as np
import joblib
from collections import deque
from model import LSTMAutoencoder  # Importing the class you defined in model.py

app = Flask(__name__)

# --- CONFIGURATION ---
SEQ_LENGTH = 30
FEATURES = 2
EMBEDDING_DIM = 64
DEVICE = 'cpu' # Keep it simple for the API

# --- GLOBAL MEMORY (THE BUFFER) ---
# This stores the last 30 readings.
# maxlen=30 ensures that when we add the 31st item, the 1st one automatically pops off.
data_buffer = deque(maxlen=SEQ_LENGTH)

# --- LOAD ARTIFACTS ---
print("Loading AI Brain...")

# 1. Load Scaler
scaler = joblib.load('scaler.save')

# 2. Load Threshold
with open('threshold.txt', 'r') as f:
    THRESHOLD = float(f.read())

# 3. Load Model Architecture & Weights
model = LSTMAutoencoder(seq_length=SEQ_LENGTH, n_features=FEATURES, embedding_dim=EMBEDDING_DIM)
model.load_state_dict(torch.load('lstm_autoencoder.pth', map_location=torch.device('cpu')))
model.eval() # Set to evaluation mode (turns off training layers like Dropout)

print(f"System Ready. Threshold: {THRESHOLD:.6f}")

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json()
        
        # 1. Extract Data
        # Ensure these match your Data Contract exactly
        temp = data['temperature']
        vib = data['vibration']
        
        # 2. Preprocessing (Scaling)
        # transform expects 2D array [[temp, vib]]
        input_vector = np.array([[temp, vib]])
        scaled_vector = scaler.transform(input_vector)
        
        # 3. Update Buffer
        # We append the scaled data to our rolling window
        data_buffer.append(scaled_vector[0])
        
        # 4. Check for "Cold Start"
        # If we don't have 30 points yet, we can't run the LSTM.
        if len(data_buffer) < SEQ_LENGTH:
            return jsonify({
                "is_anomaly": False,
                "status": "initializing",
                "buffer_size": len(data_buffer),
                "message": f"Need {SEQ_LENGTH} data points to start. Current: {len(data_buffer)}"
            })
            
        # 5. Inference
        # Convert buffer to a 3D Tensor: (1 sample, 30 time steps, 2 features)
        input_tensor = torch.tensor(np.array([data_buffer]), dtype=torch.float32)
        
        with torch.no_grad():
            reconstruction = model(input_tensor)
            
            # Calculate Loss (MSE) for this specific sequence
            loss = torch.mean((input_tensor - reconstruction)**2).item()
            
        # 6. Decision Logic
        is_anomaly = loss > THRESHOLD
        
        return jsonify({
            "is_anomaly": bool(is_anomaly),
            "anomaly_score": float(loss),
            "threshold": float(THRESHOLD),
            "status": "active"
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)