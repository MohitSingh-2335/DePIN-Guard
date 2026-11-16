import os
import json
import time
import joblib
import numpy as np
import pandas as pd
import torch
import torch.nn.functional as F
from sklearn.metrics import precision_recall_fscore_support

from gnn_model import DeviceGCN, build_factory_adjacency_matrix

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_SENSORS = os.path.join(ROOT_DIR, "data", "sensor_data.csv")
DATA_PLC = os.path.join(ROOT_DIR, "data", "plc_industrial_control_dataset (1).csv")
SCALER_PATH = os.path.join(os.path.dirname(__file__), "scaler.save")
GNN_MODEL_PATH = os.path.join(os.path.dirname(__file__), "gnn_model.pth")
METRICS_PATH = os.path.join(os.path.dirname(__file__), "metrics.json")

NUM_DEVICES = 33
EPOCHS = 30
LR = 0.01


def load_factory_graph_snapshots():
    """
    Constructs graph snapshots for the 33 factory devices across real timestamps.
    Returns: list of (X, y) where X is (33, 6) and y is (33,)
    """
    print(f"Loading sensor dataset: {DATA_SENSORS}")
    df_sensors = pd.read_csv(DATA_SENSORS)
    pivoted = df_sensors.pivot_table(index="timestamp", columns="sensor", values="value").reset_index()

    if "is_anomaly" in df_sensors.columns:
        anom = df_sensors.groupby("timestamp")["is_anomaly"].max().reset_index()
        pivoted["is_anomaly"] = anom["is_anomaly"]
    else:
        pivoted["is_anomaly"] = 0

    print(f"Loading PLC dataset: {DATA_PLC}")
    df_plc = pd.read_csv(DATA_PLC, nrows=len(pivoted))

    scaler = joblib.load(SCALER_PATH)

    current_cols = [c for c in ["Current_1", "Current_2", "Current_3"] if c in pivoted.columns]
    curr_vals = pivoted[current_cols].mean(axis=1).values if current_cols else np.full(len(pivoted), 0.12)

    voltage_cols = [c for c in ["Phase_1_Voltage", "Phase_2_Voltage", "Phase_3_Voltage"] if c in pivoted.columns]
    volt_vals = pivoted[voltage_cols].mean(axis=1).values if voltage_cols else np.full(len(pivoted), 217.5)

    emergency_stop = df_plc["emergency_stop"].astype(bool).values if "emergency_stop" in df_plc.columns else np.zeros(len(pivoted), dtype=bool)
    anom_vals = ((pivoted["is_anomaly"].values == 1) | emergency_stop).astype(int)

    temp_vals = pivoted["Temperature"].values
    vib_vals = pivoted["Vibration"].values
    pwr_vals = pivoted["Energy_Consumption"].round(2).values
    press_vals = df_plc["hydraulic_pressure"].values

    total_steps = len(pivoted)
    snapshots_X = []
    snapshots_y = []

    # Build graph snapshots: each snapshot is all 33 machines at step t
    for t in range(0, total_steps - NUM_DEVICES, NUM_DEVICES):
        node_features = []
        node_labels = []
        for dev_i in range(NUM_DEVICES):
            idx = t + dev_i
            node_features.append([
                temp_vals[idx],
                vib_vals[idx],
                pwr_vals[idx],
                curr_vals[idx],
                volt_vals[idx],
                press_vals[idx]
            ])
            node_labels.append(int(anom_vals[idx]))

        scaled_nodes = scaler.transform(np.array(node_features))
        snapshots_X.append(scaled_nodes)
        snapshots_y.append(node_labels)

    return np.array(snapshots_X), np.array(snapshots_y)


def train_gnn():
    print("=" * 60)
    print("TRAINING PURE-PYTORCH DeviceGCN ON FACTORY TOPOLOGY")
    print("=" * 60)

    X_all, y_all = load_factory_graph_snapshots()
    print(f"Generated {len(X_all)} graph snapshots (each has {NUM_DEVICES} machine nodes).")

    # Split train (80%) and test (20%)
    split = int(len(X_all) * 0.8)
    X_train, y_train = X_all[:split], y_all[:split]
    X_test, y_test = X_all[split:], y_all[split:]

    adj_norm = build_factory_adjacency_matrix(NUM_DEVICES)

    model = DeviceGCN(in_features=6, hidden_dim=16, num_classes=2)
    optimizer = torch.optim.Adam(model.parameters(), lr=LR, weight_decay=1e-4)

    print(f"\nTraining DeviceGCN for {EPOCHS} epochs...")
    start_time = time.time()
    model.train()

    for epoch in range(EPOCHS):
        total_loss = 0.0
        for X_snap, y_snap in zip(X_train, y_train):
            optimizer.zero_grad()
            x_tensor = torch.tensor(X_snap, dtype=torch.float32)
            y_tensor = torch.tensor(y_snap, dtype=torch.long)

            out = model(x_tensor, adj_norm)
            loss = F.nll_loss(out, y_tensor)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()

        avg_loss = total_loss / len(X_train)
        if (epoch + 1) % 5 == 0 or epoch == 0:
            print(f"Epoch [{epoch + 1:2d}/{EPOCHS}] - Graph NLL Loss: {avg_loss:.4f}")

    duration = time.time() - start_time
    print(f"Training completed in {duration:.2f} seconds.")

    # Evaluation on held-out test graph snapshots
    model.eval()
    all_preds = []
    all_targets = []
    with torch.no_grad():
        for X_snap, y_snap in zip(X_test, y_test):
            x_tensor = torch.tensor(X_snap, dtype=torch.float32)
            out = model(x_tensor, adj_norm)
            preds = torch.argmax(out, dim=1).numpy()
            all_preds.extend(preds)
            all_targets.extend(y_snap)

    all_preds = np.array(all_preds)
    all_targets = np.array(all_targets)

    acc = (all_preds == all_targets).mean()
    prec, rec, f1, _ = precision_recall_fscore_support(all_targets, all_preds, average="binary", zero_division=0)

    print("\nDeviceGCN Held-Out Test Evaluation:")
    print(f"  Test Device Nodes:   {len(all_targets)}")
    print(f"  Accuracy:            {acc * 100:.2f}%")
    print(f"  Precision:           {prec * 100:.2f}%")
    print(f"  Recall:              {rec * 100:.2f}%")
    print(f"  F1 Score:            {f1 * 100:.2f}%")

    torch.save(model.state_dict(), GNN_MODEL_PATH)
    print(f"Saved trained GNN weights to: {GNN_MODEL_PATH}")

    # Append to metrics.json
    metrics = {}
    if os.path.exists(METRICS_PATH):
        try:
            with open(METRICS_PATH, "r", encoding="utf-8") as f:
                metrics = json.load(f)
        except Exception:
            metrics = {}

    metrics.update({
        "gnn_model_name": "PyTorch DeviceGCN Graph Neural Network",
        "gnn_accuracy": round(acc * 100, 2),
        "gnn_precision": round(prec * 100, 2),
        "gnn_recall": round(rec * 100, 2),
        "gnn_f1": round(f1 * 100, 2),
        "gnn_tested_nodes": len(all_targets),
        "gnn_updated_at": time.strftime("%Y-%m-%d %H:%M:%S")
    })

    with open(METRICS_PATH, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)
    print(f"Saved GNN metrics to: {METRICS_PATH}")
    print("=" * 60)


if __name__ == "__main__":
    train_gnn()
