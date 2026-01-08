import torch
import torch.nn as nn

class LSTMAutoencoder(nn.Module):
    def __init__(self, seq_length, n_features, embedding_dim=64):
        super(LSTMAutoencoder, self).__init__()
        
        self.seq_length = seq_length
        self.n_features = n_features
        self.embedding_dim = embedding_dim

        # Encoder
        self.encoder1 = nn.LSTM(
            input_size=n_features, 
            hidden_size=embedding_dim, 
            batch_first=True
        )
        self.encoder2 = nn.LSTM(
            input_size=embedding_dim, 
            hidden_size=embedding_dim // 2, 
            batch_first=True
        )

        # Decoder
        self.decoder1 = nn.LSTM(
            input_size=embedding_dim // 2, 
            hidden_size=embedding_dim, 
            batch_first=True
        )
        self.decoder2 = nn.LSTM(
            input_size=embedding_dim, 
            hidden_size=n_features, 
            batch_first=True
        )

    def forward(self, x):
        # x shape: (batch, seq_length, n_features)
        
        # 1. Encode
        x, (_, _) = self.encoder1(x)
        x, (hidden_n, _) = self.encoder2(x)
        
        # --- THE FIX IS HERE ---
        # hidden_n shape comes out as: (1, batch, hidden_size)
        # We need to swap dimensions to: (batch, 1, hidden_size)
        hidden_n = hidden_n.permute(1, 0, 2)
        
        # Now we repeat it to match the sequence length
        # Result shape: (batch, seq_length, hidden_size)
        x = hidden_n.repeat(1, self.seq_length, 1)
        # -----------------------
        
        # 3. Decode
        x, (_, _) = self.decoder1(x)
        x, (_, _) = self.decoder2(x)
        
        # Final shape: (batch, seq_length, n_features)
        return x