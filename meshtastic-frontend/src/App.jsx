// src/App.jsx
// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Map, MessageSquare, Activity, Settings } from 'lucide-react';

import NetworkMap from './components/NetworkMap'; 
import SensorStatus from './components/SensorStatus'; // <--- We use this now!
import NetworkChat from './components/NetworkChat'; 
import DeviceAdmin from './components/DeviceAdmin'; 

export default function App() {
  return (
    <Router>
      <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif' }}>
        
        <div style={{ width: '250px', backgroundColor: '#1e293b', color: 'white', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <h2 style={{ color: '#38bdf8', marginBottom: '30px' }}>Mesh Admin</h2>
          
          <Link to="/" style={{ color: 'white', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Map size={20} /> Live Map
          </Link>
          <Link to="/chat" style={{ color: 'white', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <MessageSquare size={20} /> Network Chat
          </Link>
          {/* Still using the /telemetry URL path, but the label correctly says Sensor Status */}
          <Link to="/telemetry" style={{ color: 'white', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Activity size={20} /> Sensor Status
          </Link>
          <Link to="/admin" style={{ color: 'white', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Settings size={20} /> Device Admin
          </Link>
        </div>

        <div style={{ flex: 1, backgroundColor: '#f8fafc', overflowY: 'auto' }}>
          <Routes>
            <Route path="/" element={<NetworkMap />} />
            <Route path="/chat" element={<NetworkChat />} /> 
            {/* THIS LINE CHANGED: Render SensorStatus instead of TelemetryDashboard */}
            <Route path="/telemetry" element={<SensorStatus />} /> 
            <Route path="/admin" element={<DeviceAdmin />} /> 
          </Routes>
        </div>

      </div>
    </Router>
  );
}