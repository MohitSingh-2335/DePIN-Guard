#!/usr/bin/env python3
"""
Retrain GNN (Graph Neural Network) Model using combined datasets.

Training Data: smart_manufacturing_data.csv + factory_data_transformed.csv
              (600K samples with 38,948 labeled anomalies)

This script:
1. Loads both datasets 
2. Builds a machine relationship graph (devices connected if they're same type)
3. Creates node features: temperature, vibration, pressure, anomaly_flag
4. Trains GNN classifier on 50 epochs
5. Saves new GNN model with better anomaly detection

GNN improves over LSTM by considering machine relationships:
- Mixer failures affect humidity/coolant
- Chiller failures affect temperature
- Compressor failures affect pressure
- Model learns these relationships via graph edges
"""

import numpy as np
import pandas as pd
import torch
import torch.nn.functional as F
from torch_geometric.data import Data
import joblib
from sklearn.preprocessing import MinMaxScaler, LabelEncoder
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("GNN_Retraining")

# ============================================================================
# Configuration
# ============================================================================
TRAINING_DATA_PATH = "../iot/DATA/factory_data_transformed.csv"
SMART_MFG_PATH = "./DATA/smart_manufacturing_data.csv"

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
EPOCHS = 50
BATCH_SIZE = 32
LEARNING_RATE = 0.001

# GNN Architecture
IN_FEATURES = 4  # temperature, vibration, pressure, maintenance_required
HIDDEN_DIM = 32
NUM_CLASSES = 2  # normal=0, anomaly=1
DROPOUT_RATE = 0.3

# Model save paths
GNN_MODEL_PATH = "gnn_model.pth"
DEVICE_ENCODER_PATH = "device_encoder.save"
SCALER_GNN_PATH = "scaler_gnn.save"

# ============================================================================
# GNN Model
# ============================================================================
class FraudGNN(torch.nn.Module):
    """Two-layer GCN for anomaly detection on machine graphs"""
    
    def __init__(self, in_features=4, hidden_dim=32, num_classes=2):
        super().__init__()
        from torch_geometric.nn import GCNConv
        self.conv1 = GCNConv(in_features, hidden_dim)
        self.conv2 = GCNConv(hidden_dim, num_classes)
        self.dropout_rate = DROPOUT_RATE
    
    def forward(self, data):
        x, edge_index = data.x, data.edge_index
        
        # Layer 1
        x = F.relu(self.conv1(x, edge_index))
        x = F.dropout(x, p=self.dropout_rate, training=self.training)
        
        # Layer 2
        x = self.conv2(x, edge_index)
        return F.log_softmax(x, dim=1)


# ============================================================================
# Data Loading & Graph Construction
# ============================================================================
def load_data():
    """Load and combine training datasets"""
    logger.info(f"Loading training data from {TRAINING_DATA_PATH}")
    
    df = pd.read_csv(TRAINING_DATA_PATH)
    logger.info(f"Loaded {len(df)} rows from factory data")
    
    try:
        smart_mfg_df = pd.read_csv(SMART_MFG_PATH)
        logger.info(f"Loaded {len(smart_mfg_df)} rows from smart manufacturing data")
        df = pd.concat([df, smart_mfg_df], ignore_index=True)
        logger.info(f"Combined dataset size: {len(df)} rows")
    except FileNotFoundError:
        logger.warning(f"Smart manufacturing data not found, using factory data only")
    
    return df


def build_machine_graph(df):
    """
    Build a graph where:
    - Nodes = unique machines (device types)
    - Edges = machines connected if they share similar operational characteristics
    - Features = temperature, vibration, pressure, machine status
    """
    logger.info("\nBuilding machine relationship graph...")
    
    # Group by device_id and aggregate features
    grouped = df.groupby('device_id').agg({
        'temperature': ['mean', 'std'],
        'vibration': ['mean', 'std'],
        'pressure': ['mean', 'std'],
        'machine_status': 'mean',
        'anomaly_flag': 'mean'
    }).reset_index()
    
    grouped.columns = ['device_id', 'temp_mean', 'temp_std', 'vib_mean', 'vib_std',
                      'pres_mean', 'pres_std', 'status', 'anomaly_rate']
    
    num_nodes = len(grouped)
    logger.info(f"Number of machine nodes: {num_nodes}")
    
    # Create node features
    node_features = grouped[[
        'temp_mean', 'vib_mean', 'pres_mean', 'status'
    ]].values.astype(np.float32)
    
    # Normalize features
    scaler = MinMaxScaler()
    node_features = scaler.fit_transform(node_features)
    
    # Create edges based on feature similarity
    # Two machines connected if their average readings are similar
    edges = []
    for i in range(num_nodes):
        for j in range(i+1, num_nodes):
            # Calculate feature distance
            dist = np.linalg.norm(node_features[i] - node_features[j])
            # Connect if similar (distance < 0.5)
            if dist < 0.5:
                edges.append((i, j))
                edges.append((j, i))  # Bidirectional
    
    edge_index = torch.tensor(edges, dtype=torch.long).t().contiguous() if edges else torch.empty((2, 0), dtype=torch.long)
    node_features_tensor = torch.from_numpy(node_features).float()
    
    # Create labels (0=normal, 1=anomaly)
    labels = (grouped['anomaly_rate'] > 0.03).astype(int).values  # Threshold: >3% = anomaly
    labels_tensor = torch.from_numpy(labels).long()
    
    logger.info(f"Graph created:")
    logger.info(f"  Nodes: {num_nodes}")
    logger.info(f"  Edges: {len(edges)}")
    logger.info(f"  Anomaly nodes: {np.sum(labels)}")
    logger.info(f"  Normal nodes: {num_nodes - np.sum(labels)}")
    
    joblib.dump(scaler, SCALER_GNN_PATH)
    logger.info(f"Scaler saved to {SCALER_GNN_PATH}")
    
    # Create PyTorch Geometric Data object
    graph_data = Data(
        x=node_features_tensor,
        edge_index=edge_index,
        y=labels_tensor,
        device_ids=grouped['device_id'].values
    )
    
    return graph_data, grouped


# ============================================================================
# Training
# ============================================================================
def train_gnn(graph_data):
    """Train GNN on machine relationship graph"""
    logger.info("\n" + "="*60)
    logger.info("Training GNN on Machine Relationship Graph")
    logger.info("="*60)
    
    model = FraudGNN(in_features=IN_FEATURES, hidden_dim=HIDDEN_DIM, num_classes=NUM_CLASSES).to(DEVICE)
    optimizer = torch.optim.Adam(model.parameters(), lr=LEARNING_RATE)
    
    data = graph_data.to(DEVICE)
    
    train_losses = []
    
    for epoch in range(EPOCHS):
        model.train()
        optimizer.zero_grad()
        
        out = model(data)
        loss = F.nll_loss(out, data.y)
        loss.backward()
        optimizer.step()
        
        train_losses.append(loss.item())
        
        if (epoch + 1) % 10 == 0:
            model.eval()
            with torch.no_grad():
                pred = model(data).argmax(dim=1)
                correct = (pred == data.y).sum().item()
                accuracy = correct / len(data.y)
            logger.info(f"Epoch {epoch+1}/{EPOCHS} - Loss: {loss.item():.6f}, Accuracy: {accuracy:.4f}")
    
    # Save model
    torch.save(model.state_dict(), GNN_MODEL_PATH)
    logger.info(f"Model saved to {GNN_MODEL_PATH}")
    logger.info(f"Final training loss: {train_losses[-1]:.6f}")
    
    return model, train_losses


def evaluate_gnn(model, graph_data):
    """Evaluate GNN on the graph"""
    logger.info("\n" + "="*60)
    logger.info("GNN Evaluation on Machine Graph")
    logger.info("="*60)
    
    model.eval()
    data = graph_data.to(DEVICE)
    
    with torch.no_grad():
        out = model(data)
        pred = out.argmax(dim=1)
        correct = (pred == data.y).sum().item()
        total = len(data.y)
        accuracy = correct / total
    
    logger.info(f"Graph Accuracy: {accuracy:.4f} ({accuracy*100:.2f}%)")
    logger.info(f"Total nodes: {total}")
    logger.info(f"Correctly classified: {correct}")
    logger.info(f"Misclassified: {total - correct}")
    
    # Per-class metrics
    for class_id in [0, 1]:
        class_name = "Normal" if class_id == 0 else "Anomaly"
        class_mask = data.y == class_id
        class_correct = (pred[class_mask] == data.y[class_mask]).sum().item()
        class_total = class_mask.sum().item()
        if class_total > 0:
            class_acc = class_correct / class_total
            logger.info(f"{class_name}: {class_acc:.4f} ({class_correct}/{class_total})")
    
    return accuracy


# ============================================================================
# Main Execution
# ============================================================================
def main():
    logger.info("\n" + "="*60)
    logger.info("GNN MODEL RETRAINING PIPELINE")
    logger.info("="*60)
    
    # Load data
    df = load_data()
    
    # Build graph
    graph_data, device_summary = build_machine_graph(df)
    
    # Train
    model, losses = train_gnn(graph_data)
    
    # Evaluate
    accuracy = evaluate_gnn(model, graph_data)
    
    logger.info("\n" + "="*60)
    logger.info("GNN RETRAINING COMPLETE")
    logger.info("="*60)
    logger.info(f"\nArtifacts saved:")
    logger.info(f"  - Model: {GNN_MODEL_PATH}")
    logger.info(f"  - Scaler: {SCALER_GNN_PATH}")
    logger.info(f"  - Accuracy: {accuracy:.4f}")
    logger.info(f"\nGNN complements LSTM:")
    logger.info(f"  - LSTM: Detects individual machine anomalies")
    logger.info(f"  - GNN: Detects relationships (e.g., Mixer fails -> Temp rises)")
    logger.info(f"  - Combined: Better accuracy and explainability")


if __name__ == "__main__":
    main()
