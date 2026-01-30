from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # API Settings
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "IoT Dashboard"
    
    # Security
    SECRET_KEY: str = "your-secret-key-here-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Database (if using)
    DATABASE_URL: str = "sqlite:///./iot_dashboard.db"
    
    # MQTT
    MQTT_BROKER: str = "localhost"
    MQTT_PORT: int = 1883
    
    # Blockchain
    BLOCKCHAIN_NETWORK: str = "hyperledger-fabric"
    
    class Config:
        env_file = ".env"

settings = Settings()
