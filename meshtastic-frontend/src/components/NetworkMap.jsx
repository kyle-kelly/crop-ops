import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from 'react-leaflet'; // <-- Added useMap
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const createCustomMarker = (color) => {
  return L.divIcon({
    className: "custom-color-marker",
    html: `<div style="background-color: ${color}; width: 22px; height: 22px; border-radius: 50%; border: 3px solid white; box-shadow: 0 3px 6px rgba(0,0,0,0.4);"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11] 
  });
};

// NEW: This component calculates the bounding box of all nodes and auto-zooms the map
function AutoFitBounds({ positions }) {
  const map = useMap();

  useEffect(() => {
    // 1. Extract all valid latitude/longitude pairs from your nodes
    const coords = Object.values(positions)
      .filter(p => p.lat && p.lon)
      .map(p => [p.lat, p.lon]);

    // 2. If we have coordinates, draw a boundary box and zoom to it
    if (coords.length > 0) {
      const bounds = L.latLngBounds(coords);
      // padding prevents markers from getting cut off at the absolute edges of the screen
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }
  }, [positions, map]); // Re-runs anytime a node moves!

  return null;
}

export default function NetworkMap() {
  const [nodePositions, setNodePositions] = useState({});
  const [latestEvent, setLatestEvent] = useState(null);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8000/ws");
    ws.onmessage = (event) => setLatestEvent(JSON.parse(event.data));
    return () => ws.close();
  }, []);

  useEffect(() => {
    async function loadInitialData() {
      try {
        const nodesRes = await fetch("http://localhost:8000/api/nodes");
        const nodes = await nodesRes.json();
        const initialData = {};
        
        for (const node of nodes) {
          const telRes = await fetch(`http://localhost:8000/api/nodes/${node.node_id}/telemetry?limit=1`);
          const telData = await telRes.json();
          const latestTel = telData.length > 0 ? telData[0] : null;

          let lat = null;
          let lon = null;
          let isFixed = false;

          if (node.fixed_latitude && node.fixed_longitude) {
            lat = node.fixed_latitude;
            lon = node.fixed_longitude;
            isFixed = true;
          } else {
            const posRes = await fetch(`http://localhost:8000/api/nodes/${node.node_id}/positions?limit=1`);
            const posData = await posRes.json();
            if (posData.length > 0) {
              lat = posData[0].latitude;
              lon = posData[0].longitude;
            }
          }

          if (lat !== null && lon !== null) {
            initialData[node.node_id] = {
              lat, lon, isFixed,
              color: node.color || "#38bdf8",
              short_name: node.short_name || node.node_id.slice(-4),
              last_heard: node.last_heard,
              battery: latestTel?.battery_level,
              temp: latestTel?.temperature
            };
          }
        }
        setNodePositions(initialData);
      } catch (error) {
        console.error("Failed to fetch map data:", error);
      }
    }
    loadInitialData();
  }, []);

  useEffect(() => {
    if (!latestEvent) return;

    setNodePositions((prev) => {
      const node = prev[latestEvent.node_id] || {};
      
      let newLat = node.lat;
      let newLon = node.lon;
      if (latestEvent.event === "gps_update" && !node.isFixed) {
        newLat = latestEvent.lat;
        newLon = latestEvent.lon;
      }

      if (!newLat || !newLon) return prev;

      return {
        ...prev,
        [latestEvent.node_id]: {
          ...node,
          lat: newLat,
          lon: newLon,
          color: node.color || "#38bdf8",
          short_name: node.short_name || latestEvent.node_id.slice(-4),
          last_heard: new Date().toISOString(),
          battery: latestEvent.event === "telemetry_update" ? latestEvent.battery : node.battery,
          temp: latestEvent.event === "telemetry_update" ? latestEvent.temperature : node.temp,
        }
      };
    });
  }, [latestEvent]);

  return (
    <div style={{ height: "100vh", width: "100%" }}>
      {/* We leave a default center here just in case the database is completely empty */}
      <MapContainer center={[38.9072, -77.0369]} zoom={10} style={{ height: "100%", width: "100%" }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        
        {/* NEW: Drop the AutoFit bounds component inside the map! */}
        <AutoFitBounds positions={nodePositions} />
        
        {Object.entries(nodePositions).map(([nodeId, data]) => (
          <Marker key={nodeId} position={[data.lat, data.lon]} icon={createCustomMarker(data.color)}>
            <Tooltip direction="top" offset={[0, -10]} opacity={0.95}>
              <div style={{ textAlign: "center", minWidth: "120px", fontFamily: "sans-serif" }}>
                <div style={{ fontWeight: "900", fontSize: "1.1em", color: data.color, borderBottom: "1px solid #e2e8f0", paddingBottom: "4px", marginBottom: "4px" }}>
                  {data.short_name}
                </div>
                <div style={{ fontSize: "0.85em", color: "#64748b", marginBottom: "6px" }}>
                  {data.last_heard ? new Date(data.last_heard).toLocaleTimeString() : "Unknown"}
                </div>
                {data.battery !== undefined && (
                  <div style={{ fontSize: "0.9em", color: "#334155" }}>🔋 {data.battery}%</div>
                )}
                {data.temp !== undefined && (
                  <div style={{ fontSize: "0.9em", color: "#334155" }}>🌡️ {data.temp}°C</div>
                )}
              </div>
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}