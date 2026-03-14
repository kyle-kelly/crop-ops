import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'; // <-- Added useMap
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Helper component to capture map clicks
function LocationPicker({ position, setPosition }) {
  useMapEvents({ click(e) { setPosition({ lat: e.latlng.lat, lng: e.latlng.lng }); } });
  return position.lat ? <Marker position={[position.lat, position.lng]} /> : null;
}

// NEW: Smart Map Controller for Auto-Zooming
function MapController({ coords }) {
  const map = useMap();

  useEffect(() => {
    if (coords.lat && coords.lng) {
      // 1. If coordinates already exist, zoom directly to them (zoom level 15 is a close-up)
      map.setView([coords.lat, coords.lng], 15);
    } else {
      // 2. If no coordinates exist, ask the browser for the user's real-world location!
      map.locate().on("locationfound", function (e) {
        map.setView(e.latlng, 13);
      });
    }
  }, [coords, map]);

  return null;
}

export default function SensorStatus() {
  const [sensors, setSensors] = useState([]);
  const [telemetry, setTelemetry] = useState({});
  const [settingLocationFor, setSettingLocationFor] = useState(null);
  const [coords, setCoords] = useState({ lat: "", lng: "" });

  const fetchSensorsAndData = async () => {
    try {
      const response = await fetch("http://localhost:8000/api/nodes");
      const data = await response.json();
      
      const sensorNodes = data.filter(node => node.role === "sensor");
      setSensors(sensorNodes);

      const telMap = {};
      for (const sensor of sensorNodes) {
        const telRes = await fetch(`http://localhost:8000/api/nodes/${sensor.node_id}/telemetry?limit=1`);
        const telData = await telRes.json();
        if (telData.length > 0) telMap[sensor.node_id] = telData[0];
      }
      setTelemetry(telMap);
    } catch (error) { console.error("Failed to fetch sensor data:", error); }
  };

  useEffect(() => { fetchSensorsAndData(); }, []);

  const handleSaveLocation = async (e) => {
    e.preventDefault();
    await fetch(`http://localhost:8000/api/nodes/${settingLocationFor}/config`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fixed_latitude: coords.lat, fixed_longitude: coords.lng })
    });
    setSettingLocationFor(null);
    fetchSensorsAndData(); 
  };

  // NEW: Listen for live Door events
  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8000/ws");
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.event === "door_update") {
        // Update the specific sensor's door state in real-time
        setSensors(prevSensors => prevSensors.map(s => 
          s.node_id === data.node_id ? { ...s, door_state: data.door_state } : s
        ));
      }
    };
    return () => ws.close();
  }, []);

  return (
    <div style={{ padding: "30px", maxWidth: "1200px", margin: "0 auto" }}>
      <h2 style={{ borderBottom: "2px solid #e2e8f0", paddingBottom: "10px" }}>Sensor Dashboard</h2>
      
      <div style={{ display: "grid", gap: "20px", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", marginTop: "20px" }}>
        {sensors.length === 0 ? (
          <p>No nodes assigned to the 'Sensor' role yet. Go to Device Admin to assign them.</p>
        ) : (
          sensors.map((sensor) => {
            const data = telemetry[sensor.node_id] || {};
            return (
              <div key={sensor.node_id} style={{ backgroundColor: "white", padding: "20px", borderRadius: "12px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)", border: "1px solid #e2e8f0" }}>
                <h3 style={{ margin: "0 0 10px 0" }}>{sensor.long_name || "Unnamed Sensor"} <small>({sensor.node_id})</small></h3>
                
                <div style={{ display: "flex", justifyContent: "space-around", margin: "20px 0" }}>
                  <div style={{ textAlign: "center", fontSize: "1.2em", fontWeight: "bold" }}>🔋 {data.battery_level ?? "--"}%</div>
                  <div style={{ textAlign: "center", fontSize: "1.2em", fontWeight: "bold" }}>🌡️ {data.temperature ?? "--"}°C</div>
                  
                  {/* NEW: Only render this block if the sensor actually has a door_state */}
                  {sensor.door_state && (
                    <div style={{ textAlign: "center", fontSize: "1.2em", fontWeight: "bold", color: sensor.door_state === "Open" ? "#ef4444" : "#22c55e" }}>
                      🚪 {sensor.door_state}
                    </div>
                  )}
                </div>

                <div style={{ backgroundColor: "#f8fafc", padding: "12px", borderRadius: "8px", fontSize: "0.85em" }}>
                  <p style={{ margin: "0 0 10px 0" }}>
                    <strong>Location:</strong> {sensor.fixed_latitude ? `${sensor.fixed_latitude.toFixed(4)}, ${sensor.fixed_longitude.toFixed(4)}` : "None Set"}
                  </p>
                  
                  <button 
                    onClick={() => {
                      setSettingLocationFor(sensor.node_id);
                      setCoords({ lat: sensor.fixed_latitude || "", lng: sensor.fixed_longitude || "" });
                    }}
                    style={{ width: "100%", padding: "8px", backgroundColor: "#e0f2fe", border: "1px solid #bae6fd", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}
                  >
                    📍 Set Map Location
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Map Modal */}
      {settingLocationFor && (
        <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", backgroundColor: "white", padding: "30px", borderRadius: "12px", zIndex: 1000, boxShadow: "0 20px 25px rgba(0,0,0,0.2)", width: "500px" }}>
          <h3 style={{ marginTop: 0 }}>Set Location</h3>
          <div style={{ height: "300px", borderRadius: "8px", overflow: "hidden", border: "1px solid #cbd5e1", marginBottom: "20px" }}>
            {/* The default center is here as a fallback, but MapController overrides it immediately */}
            <MapContainer center={[38.9072, -77.0369]} zoom={10} style={{ height: "100%", width: "100%" }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              
              {/* NEW: Insert the Smart Controller */}
              <MapController coords={coords} />
              <LocationPicker position={coords} setPosition={setCoords} />
              
            </MapContainer>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button onClick={() => setSettingLocationFor(null)} style={{ padding: "10px" }}>Cancel</button>
            <button onClick={handleSaveLocation} style={{ padding: "10px", backgroundColor: "#38bdf8", color: "white", borderRadius: "6px", fontWeight: "bold" }}>Save Coordinates</button>
          </div>
        </div>
      )}
    </div>
  );
}