import torch
import torch.nn as nn
import torch.nn.functional as F


class GraphConvolution(nn.Module):
    """
    Standard Graph Convolutional layer (Kipf & Welling).
    Performs message-passing: H' = A_norm * H * W
    """
    def __init__(self, in_features: int, out_features: int):
        super().__init__()
        self.linear = nn.Linear(in_features, out_features)

    def forward(self, x: torch.Tensor, adj_norm: torch.Tensor) -> torch.Tensor:
        # x: (N_nodes, in_features)
        # adj_norm: (N_nodes, N_nodes) normalized adjacency matrix
        support = self.linear(x)
        return torch.matmul(adj_norm, support)


class DeviceGCN(nn.Module):
    """
    2-Layer Graph Convolutional Network for industrial machine correlation.
    Inputs: 33 factory machines with 6 physical sensor features.
    Outputs: 2 classes (Normal=0, Anomaly=1) for each machine.
    """
    def __init__(self, in_features: int = 6, hidden_dim: int = 16, num_classes: int = 2):
        super().__init__()
        self.gc1 = GraphConvolution(in_features, hidden_dim)
        self.gc2 = GraphConvolution(hidden_dim, num_classes)
        self.dropout = nn.Dropout(p=0.2)

    def forward(self, x: torch.Tensor, adj_norm: torch.Tensor) -> torch.Tensor:
        h1 = F.relu(self.gc1(x, adj_norm))
        h1 = self.dropout(h1)
        out = self.gc2(h1, adj_norm)
        return F.log_softmax(out, dim=1)


def build_factory_adjacency_matrix(num_devices: int = 33) -> torch.Tensor:
    """
    Constructs normalized adjacency matrix representing physical connections
    between machines on the factory floor (assembly lines and utility loops).
    """
    A = torch.eye(num_devices)
    # Connect sequential pipeline machines
    for i in range(num_devices - 1):
        A[i, i + 1] = 1.0
        A[i + 1, i] = 1.0

    # Utility loops (Compressor -> Press, Chiller -> Molder, Boiler -> Furnace, Pump -> Valve)
    utility_pairs = [(16, 15), (30, 0), (22, 13), (32, 12)]
    for u, v in utility_pairs:
        if u < num_devices and v < num_devices:
            A[u, v] = 1.0
            A[v, u] = 1.0

    # Symmetric normalization: D^(-1/2) * A * D^(-1/2)
    degrees = torch.sum(A, dim=1)
    d_inv_sqrt = torch.pow(degrees, -0.5)
    d_inv_sqrt[torch.isinf(d_inv_sqrt)] = 0.0
    D_mat = torch.diag(d_inv_sqrt)
    adj_norm = torch.matmul(torch.matmul(D_mat, A), D_mat)
    return adj_norm


if __name__ == "__main__":
    # Self-test
    adj = build_factory_adjacency_matrix(33)
    x = torch.randn(33, 6)
    model = DeviceGCN(in_features=6, hidden_dim=16, num_classes=2)
    model.eval()
    with torch.no_grad():
        out = model(x, adj)
    print("DeviceGCN output shape:", out.shape)
    print("Device 0 anomaly prob:", torch.exp(out[0])[1].item())
    print("DeviceGCN architecture verified successfully.")
