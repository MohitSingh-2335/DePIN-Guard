import torch
import torch.nn as nn
import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler
import joblib  # To save the scaler
from model import LSTMAutoencoder  # Import the class we defined earlier

# --- CONFIGURATION ---
SEQ_LENGTH = 30
FEATURES = 2  # Temperature, Vibration
EMBEDDING_DIM = 64
EPOCHS = 100
LR = 0.001

# --- STEP 1: GENERATE SYNTHETIC DATA ---
# We simulate 'normal' vibration (sine wave) and temperature (linear growth + noise)
# In production, you would load this from a CSV file.
def generate_fake_data(n_samples=3000):
    t = np.linspace(0, 100, n_samples)
    
    # Feature 1: Vibration (Periodic Sine Wave)
    vibration = np.sin(t) 
    
    # Feature 2: Temperature (Slowly varying + slight noise)
    temperature = np.linspace(20, 30, n_samples) + np.random.normal(0, 0.5, n_samples)
    
    df = pd.DataFrame({'temperature': temperature, 'vibration': vibration})
    return df

# --- STEP 2: PREPROCESSING ---
print("Generating and processing data...")
df = generate_fake_data()

# Normalize to [0, 1]
scaler = MinMaxScaler()
data_scaled = scaler.fit_transform(df)

# Create Sliding Windows (3D Tensor)
def create_sequences(data, seq_length):
    xs = []
    for i in range(len(data) - seq_length):
        x = data[i:(i + seq_length)]
        xs.append(x)
    return np.array(xs)

X_train = create_sequences(data_scaled, SEQ_LENGTH)

# Convert to PyTorch Tensor
# Shape: (Samples, 30, 2)
X_train_tensor = torch.tensor(X_train, dtype=torch.float32)

# --- STEP 3: INITIALIZE MODEL ---
model = LSTMAutoencoder(seq_length=SEQ_LENGTH, n_features=FEATURES, embedding_dim=EMBEDDING_DIM)
criterion = nn.MSELoss()
optimizer = torch.optim.Adam(model.parameters(), lr=LR)

# --- STEP 4: TRAINING LOOP ---
print("Starting training...")
model.train()
for epoch in range(EPOCHS):
    optimizer.zero_grad()
    
    # Forward pass: Try to reconstruct the input
    output = model(X_train_tensor)
    
    # Calculate Loss: Difference between Input and Reconstruction
    loss = criterion(output, X_train_tensor)
    
    # Backward pass
    loss.backward()
    optimizer.step()
    
    if (epoch+1) % 10 == 0:
        print(f'Epoch [{epoch+1}/{EPOCHS}], Loss: {loss.item():.6f}')

# --- STEP 5: CALCULATE THRESHOLD ---
# We check how bad the error is on "normal" data. 
# The max error on normal data becomes our limit for anomalies.
print("Calculating anomaly threshold...")
model.eval()
with torch.no_grad():
    reconstructions = model(X_train_tensor)
    # Calculate Mean Squared Error per sequence
    loss_per_sequence = torch.mean((X_train_tensor - reconstructions)**2, dim=[1, 2])
    
    # Set threshold to the max loss seen during training (plus a tiny buffer)
    threshold = torch.max(loss_per_sequence).item()

print(f"Training Complete. Max Normal Loss (Threshold): {threshold:.6f}")

# --- STEP 6: SAVE ARTIFACTS ---
# 1. Save the Model Weights
torch.save(model.state_dict(), 'lstm_autoencoder.pth')
# 2. Save the Scaler (Crucial for preprocessing new data identically)
joblib.dump(scaler, 'scaler.save')
# 3. Save the Threshold (Simple text file)
with open('threshold.txt', 'w') as f:
    f.write(str(threshold))

print("Model, Scaler, and Threshold saved successfully.")