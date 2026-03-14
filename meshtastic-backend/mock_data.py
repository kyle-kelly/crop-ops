import paho.mqtt.client as mqtt
import json
import time
import random

# --- CONFIGURATION ---
MQTT_BROKER = "localhost"  
CHANNEL = "MyPriv"         

# Our simulated fleet
NODES = [
    {"id": "!11111111", "sim_role": "tracker"}, # Sends GPS & Telemetry
    {"id": "!22222222", "sim_role": "sensor"},  # Sends ONLY Telemetry
    {"id": "!33333333", "sim_role": "chatter"}  # Sends Telemetry & Text Messages
]

# Random chat phrases to simulate network activity
CHAT_MESSAGES = [
    "Base station, do you copy?",
    "Weather is clearing up at sector 4.",
    "Battery running low, returning to base.",
    "Anyone seeing movement on the northern ridge?",
    "Ping. Just testing the new mesh setup!"
]

def on_connect(client, userdata, flags, reason_code, properties):
    if reason_code == 0:
        print("✅ Connected to local Docker Mosquitto Broker")
    else:
        print(f"❌ Connection failed with code {reason_code}")

def run_simulation():
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    client.on_connect = on_connect
    
    try:
        client.connect(MQTT_BROKER, 1883, 60)
    except ConnectionRefusedError:
        print("❌ Could not connect! Is your Docker stack running?")
        return

    client.loop_start()
    time.sleep(1) # Give it a second to connect

    print("\n🚀 Initiating Full-Spectrum Fleet Simulation...\n")
    
    for node in NODES:
        topic = f"msh/2/json/{CHANNEL}/{node['id']}"
        raw_from = int(node["id"].replace("!", ""), 16)
        
        # 1. SEND TELEMETRY (All devices do this)
        telemetry_packet = {
            "from": raw_from,
            "sender": node["id"],
            "type": "telemetry",
            "payload": {
                "battery_level": random.randint(45, 100),
                "voltage": round(random.uniform(3.7, 4.2), 2),
                "temperature": round(random.uniform(18.0, 32.0), 1)
            }
        }
        client.publish(topic, json.dumps(telemetry_packet))
        print(f"🔋 Transmitted TELEMETRY for {node['id']}")
        time.sleep(0.5)
        
        # 2. SEND POSITION (Only if simulating a mobile tracker)
        if node["sim_role"] == "tracker":
            lat = 38.9072 + random.uniform(-0.05, 0.05)
            lon = -77.0369 + random.uniform(-0.05, 0.05)
            
            position_packet = {
                "from": raw_from,
                "sender": node["id"],
                "type": "position",
                "payload": {
                    "latitude": lat,
                    "longitude": lon,
                    "latitude_i": int(lat * 10000000),
                    "longitude_i": int(lon * 10000000),
                    "altitude": random.randint(10, 150)
                }
            }
            client.publish(topic, json.dumps(position_packet))
            print(f"📍 Transmitted POSITION for  {node['id']}")
            time.sleep(0.5)

        # NEW: Simulate a Door Sensor Alarm (Only for the Sensor node)
        if node["sim_role"] == "sensor":
            # Randomly pick Open or Closed
            door_state = random.choice(["Open", "Closed"])
            door_packet = {
                "from": raw_from,
                "sender": node["id"],
                "to": "^all",
                "type": "text",
                "payload": {
                    "text": f"Door {door_state}" # This is the exact string our backend is looking for!
                }
            }
            client.publish(topic, json.dumps(door_packet))
            print(f"🚪 Transmitted DOOR ALARM for  {node['id']}")
            time.sleep(0.5)

        # 3. SEND TEXT MESSAGE (Only if simulating a chatter)
        if node["sim_role"] == "chatter":
            text_packet = {
                "from": raw_from,
                "sender": node["id"],
                "to": "^all", # Broadcast to entire mesh
                "type": "text",
                "payload": {
                    "text": random.choice(CHAT_MESSAGES)
                }
            }
            client.publish(topic, json.dumps(text_packet))
            print(f"💬 Transmitted TEXT for      {node['id']}")
            time.sleep(0.5)
            
        print("---")
        
    client.loop_stop()
    print("✅ Simulation complete!")
    print("➡️ Go check your Live Map, Sensor Dashboard, and Network Chat.")

if __name__ == "__main__":
    run_simulation()