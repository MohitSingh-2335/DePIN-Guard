from sklearn.ensemble import IsolationForest
import numpy as np

class AIService:
    def __init__(self):
        self.model = IsolationForest(contamination=0.1, random_state=42)
        
    def train(self, data):
        """Train the anomaly detection model"""
        X = np.array(data).reshape(-1, 1)
        self.model.fit(X)
        
    def predict(self, value):
        """Predict if value is an anomaly"""
        prediction = self.model.predict([[value]])
        # -1 for anomaly, 1 for normal
        is_anomaly = prediction[0] == -1
        
        # Calculate confidence score (mock)
        confidence = np.random.uniform(0.7, 0.99)
        
        return {
            "is_anomaly": bool(is_anomaly),
            "confidence": float(confidence),
            "severity": "high" if is_anomaly and confidence > 0.8 else "medium" if is_anomaly else "low"
        }

ai_service = AIService()
# Train with some mock data
ai_service.train([20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30])
