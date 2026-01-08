import numpy as np
from sklearn.preprocessing import MinMaxScaler

def get_preprocessed_data(df, seq_length=30):
    """
    1. Scales data to [0,1]
    2. Converts to sequences of length 30
    """
    
    # 1. Normalization
    # We only care about the features defined in your Data Contract
    features = ['temperature', 'vibration']
    scaler = MinMaxScaler()
    data_scaled = scaler.fit_transform(df[features])

    # 2. Sliding Window (Creating the 3D Tensor)
    xs = []
    # Loop through data and chop it into chunks of 30
    for i in range(len(data_scaled) - seq_length):
        x = data_scaled[i:(i + seq_length)]
        xs.append(x)
        
    # Return as a numpy array, which we can easily turn into a PyTorch Tensor later
    return np.array(xs), scaler