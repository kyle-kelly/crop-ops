import json
import asyncio
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import paho.mqtt.client as mqtt

import database
import schemas

# --- CONFIGURATION ---
MQTT_BROKER_IP = "mosquitto"  # Use "mosquitto" for Docker, or "localhost" if running outside Docker
MQTT_TOPIC = "msh/2/json/MyPriv/#" # Make sure this matches your private channel name!

# --- WEBSOCKET MANAGER ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass

manager = ConnectionManager()
loop = None

# --- MQTT WORKER ---
async def process_mqtt_message(packet: dict):
    db = database.SessionLocal()
    try:
        # 1. FIX: Ensure node_id is ALWAYS a properly formatted hex string
        raw_from = packet.get("from")
        sender_str = packet.get("sender")
        
        if sender_str and isinstance(sender_str, str) and sender_str.startswith("!"):
            node_id = sender_str
        elif raw_from:
            # Convert decimal integer back to hex, padded to 8 characters, prefixed with !
            node_id = f"!{raw_from:08x}"
        else:
            return # Skip if we can't determine an ID

        # 2. Check if node exists in DB
        node = db.query(database.Node).filter_by(node_id=node_id).first()
        if not node:
            # Create as blocked by default for security
            node = database.Node(node_id=node_id, is_approved=False, role="tracker")
            db.add(node)
            db.commit()
            db.refresh(node)
            await manager.broadcast({"event": "new_node", "node_id": node_id})

        # 3. Update last heard timestamp
        node.last_heard = datetime.utcnow()
        db.commit()

        # 4. Stop processing data if the node is not approved by the admin
        if not node.is_approved:
            return

        packet_type = packet.get("type")
        payload = packet.get("payload", {})

        # 5. Process GPS Position
        if packet_type == "position":
            lat = payload.get("latitude") or (payload.get("latitude_i", 0) / 10000000)
            lon = payload.get("longitude") or (payload.get("longitude_i", 0) / 10000000)
            
            if lat and lon:
                pos = database.Position(node_id=node_id, latitude=lat, longitude=lon)
                db.add(pos)
                db.commit()
                await manager.broadcast({"event": "gps_update", "node_id": node_id, "lat": lat, "lon": lon})

        # 6. Process Telemetry
        elif packet_type == "telemetry":
            bat = payload.get("battery_level")
            vol = payload.get("voltage")
            temp = payload.get("temperature")
            
            tel = database.Telemetry(node_id=node_id, battery_level=bat, voltage=vol, temperature=temp)
            db.add(tel)
            db.commit()
            await manager.broadcast({
                "event": "telemetry_update", 
                "node_id": node_id, 
                "battery": bat, 
                "temperature": temp
            })

        # 7. Process Text Messages & Intercept Sensor Alarms
        elif packet_type == "text":
            text_data = payload.get("text")
            to_dest = str(packet.get("to", "^all"))
            
            if text_data:
                # NEW: The Interceptor! Check if this is an automated Door alert
                if text_data.lower().startswith("door "):
                    # Extract just the state (e.g., "Open" or "Closed")
                    door_status = text_data[5:].strip().capitalize()
                    node.door_state = door_status
                    db.commit()
                    
                    # Broadcast a dedicated door event to the UI
                    await manager.broadcast({
                        "event": "door_update",
                        "node_id": node_id,
                        "door_state": door_status
                    })
                
                # If it's NOT a door alert, process it as a normal human chat message
                else:
                    msg = database.Message(
                        sender_node_id=node_id, 
                        receiver_node_id=to_dest,
                        text_payload=text_data
                    )
                    db.add(msg)
                    db.commit()
                    await manager.broadcast({
                        "event": "text_message", 
                        "sender_node_id": node_id, 
                        "text_payload": text_data,
                        "timestamp": msg.timestamp.isoformat()
                    })

    finally:
        db.close()

def on_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode())
        if loop is not None:
            # Push the processing task to the FastAPI asyncio loop safely
            asyncio.run_coroutine_threadsafe(process_mqtt_message(payload), loop)
    except Exception as e:
        print(f"Error parsing MQTT JSON: {e}")

# --- FASTAPI LIFESPAN ---
mqtt_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)

@asynccontextmanager
async def lifespan(app: FastAPI):
    global loop
    loop = asyncio.get_running_loop()
    
    # Create database tables if they don't exist
    database.Base.metadata.create_all(bind=database.engine)
    
    # Start MQTT Client
    mqtt_client.on_message = on_message
    try:
        mqtt_client.connect(MQTT_BROKER_IP, 1883, 60)
        mqtt_client.subscribe(MQTT_TOPIC)
        mqtt_client.loop_start()
        print(f"✅ Connected to MQTT Broker at {MQTT_BROKER_IP}")
    except Exception as e:
        print(f"❌ Failed to connect to MQTT: {e}")
        
    yield
    
    # Shutdown
    mqtt_client.loop_stop()
    mqtt_client.disconnect()

# --- APP INITIALIZATION ---
app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost", "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- DEPENDENCIES ---
def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- API ENDPOINTS ---

@app.get("/api/nodes")
async def get_nodes(db: Session = Depends(get_db)):
    return db.query(database.Node).all()

@app.put("/api/nodes/{node_id}/config")
async def update_node_config(node_id: str, request: schemas.ConfigUpdateRequest, db: Session = Depends(get_db)):
    node = db.query(database.Node).filter_by(node_id=node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    update_data = request.model_dump(exclude_unset=True)
    
    if "long_name" in update_data:
        node.long_name = update_data["long_name"]
    if "short_name" in update_data:
        node.short_name = update_data["short_name"]
    if "is_approved" in update_data:
        node.is_approved = update_data["is_approved"]
    if "role" in update_data:
        node.role = update_data["role"]
    if "color" in update_data:
        node.color = update_data["color"]
    if "fixed_latitude" in update_data:
        node.fixed_latitude = update_data["fixed_latitude"]
    if "fixed_longitude" in update_data:
        node.fixed_longitude = update_data["fixed_longitude"]
        
    current_config = node.device_config or {}
    if "telemetry_interval" in update_data:
        current_config["telemetry_interval"] = update_data["telemetry_interval"]
    node.device_config = current_config
    
    db.commit()
    return {"status": "success"}

@app.delete("/api/nodes/{node_id}")
async def delete_node(node_id: str, db: Session = Depends(get_db)):
    node = db.query(database.Node).filter_by(node_id=node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    
    # 1. Delete all associated telemetry logs
    db.query(database.Telemetry).filter_by(node_id=node_id).delete()
    
    # 2. Delete all associated GPS position logs
    db.query(database.Position).filter_by(node_id=node_id).delete()
    
    # 3. Delete all associated text messages sent by this node
    db.query(database.Message).filter_by(sender_node_id=node_id).delete()
    
    # 4. Finally, delete the node profile itself
    db.delete(node)
    db.commit()
    
    return {"status": "deleted", "message": f"Node {node_id} and all associated logs were permanently removed."}

@app.get("/api/nodes/{node_id}/logs")
async def get_node_logs(node_id: str, db: Session = Depends(get_db)):
    logs = db.query(database.Telemetry).filter_by(node_id=node_id).order_by(database.Telemetry.timestamp.desc()).limit(50).all()
    return logs

@app.get("/api/nodes/{node_id}/telemetry")
async def get_node_telemetry(node_id: str, limit: int = 10, db: Session = Depends(get_db)):
    return db.query(database.Telemetry).filter_by(node_id=node_id).order_by(database.Telemetry.timestamp.desc()).limit(limit).all()

@app.get("/api/nodes/{node_id}/positions")
async def get_node_positions(node_id: str, limit: int = 10, db: Session = Depends(get_db)):
    return db.query(database.Position).filter_by(node_id=node_id).order_by(database.Position.timestamp.desc()).limit(limit).all()

@app.get("/api/messages")
async def get_messages(db: Session = Depends(get_db)):
    # Fetch the last 50 messages, oldest to newest for the chat window
    return db.query(database.Message).order_by(database.Message.timestamp.asc()).limit(50).all()

@app.post("/api/messages")
async def send_message(msg: schemas.SendMessageRequest, db: Session = Depends(get_db)):
    # 1. Publish to the MQTT broker so the Gateway transmits it over LoRa
    topic = MQTT_TOPIC.replace("/#", "") + "/WebAdmin"
    packet = {
        "type": "sendtext",
        "payload": msg.text_payload,       # Matches your schema
        "dest": msg.receiver_node_id       # Matches your schema
    }
    mqtt_client.publish(topic, json.dumps(packet))
    
    # 2. Save our own outgoing message using your DB schema
    record = database.Message(
        sender_node_id=msg.sender_node_id, 
        receiver_node_id=msg.receiver_node_id,
        text_payload=msg.text_payload
    )
    db.add(record)
    db.commit()
    
    # 3. Broadcast it to the React UI instantly
    await manager.broadcast({
        "event": "text_message", 
        "sender_node_id": msg.sender_node_id, 
        "text_payload": msg.text_payload,
        "timestamp": record.timestamp.isoformat()
    })
    return {"status": "success"}


# --- WEBSOCKETS ---
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text() # Keeps connection alive
    except WebSocketDisconnect:
        manager.disconnect(websocket)