import paho.mqtt.client as mqtt
import json

class MQTTService:
    def __init__(self, broker="localhost", port=1883):
        self.broker = broker
        self.port = port
        self.client = mqtt.Client()
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        
    def on_connect(self, client, userdata, flags, rc):
        print(f"Connected to MQTT broker with result code {rc}")
        client.subscribe("iot/devices/#")
        
    def on_message(self, client, userdata, msg):
        print(f"Received message on topic {msg.topic}: {msg.payload.decode()}")
        try:
            data = json.loads(msg.payload.decode())
            # Process data here
            print(f"Processed data: {data}")
        except json.JSONDecodeError:
            print("Invalid JSON received")
    
    def connect(self):
        try:
            self.client.connect(self.broker, self.port, 60)
            self.client.loop_start()
        except Exception as e:
            print(f"Failed to connect to MQTT broker: {e}")
    
    def publish(self, topic, payload):
        result = self.client.publish(topic, json.dumps(payload))
        return result.rc == mqtt.MQTT_ERR_SUCCESS
    
    def disconnect(self):
        self.client.loop_stop()
        self.client.disconnect()

mqtt_service = MQTTService()
