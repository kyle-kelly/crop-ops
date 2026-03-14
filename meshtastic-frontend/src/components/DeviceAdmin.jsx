import React, { useState, useEffect } from 'react';

export default function DeviceAdmin() {
  const [nodes, setNodes] = useState([]);
  const [editingNode, setEditingNode] = useState(null);
  const [viewingLogs, setViewingLogs] = useState(null);
  const [logsData, setLogsData] = useState([]);
  
  const [formData, setFormData] = useState({
    long_name: "", short_name: "", role: "tracker", color: "#38bdf8", is_approved: true
  });

  const fetchNodes = async () => {
    try {
      const response = await fetch("http://localhost:8000/api/nodes");
      setNodes(await response.json());
    } catch (error) { console.error("Failed to fetch nodes", error); }
  };

  useEffect(() => { fetchNodes(); }, []);

  const handleDelete = async (node_id) => {
    if (!window.confirm(`Delete ${node_id}? It will reappear as 'Blocked' if it transmits again.`)) return;
    await fetch(`http://localhost:8000/api/nodes/${node_id}`, { method: "DELETE" });
    fetchNodes();
  };

  const handleViewLogs = async (node_id) => {
    const res = await fetch(`http://localhost:8000/api/nodes/${node_id}/logs`);
    setLogsData(await res.json());
    setViewingLogs(node_id);
  };

  const handleEditClick = (node) => {
    setEditingNode(node.node_id);
    setFormData({
      long_name: node.long_name || "",
      short_name: node.short_name || "",
      role: node.role || "tracker",
      color: node.color || "#38bdf8", // NEW: Load existing color or default blue
      is_approved: node.is_approved
    });
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    await fetch(`http://localhost:8000/api/nodes/${editingNode}/config`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData)
    });
    setEditingNode(null); 
    fetchNodes();         
  };

  return (
    <div style={{ padding: "30px", maxWidth: "1000px", margin: "0 auto" }}>
      <h2 style={{ borderBottom: "2px solid #e2e8f0", paddingBottom: "10px" }}>Device Management</h2>
      <div style={{ backgroundColor: "white", borderRadius: "8px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead style={{ backgroundColor: "#f8fafc" }}>
            <tr>
              <th style={{ padding: "15px" }}>ID</th>
              <th style={{ padding: "15px" }}>Name / Label</th>
              <th style={{ padding: "15px" }}>Role</th>
              <th style={{ padding: "15px" }}>Status</th>
              <th style={{ padding: "15px" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {nodes.map((node) => (
              <tr key={node.node_id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "15px", fontFamily: "monospace" }}>{node.node_id}</td>
                <td style={{ padding: "15px", display: "flex", alignItems: "center", gap: "10px" }}>
                  {/* NEW: Color indicator dot */}
                  <div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: node.color || "#38bdf8" }}></div>
                  <div>
                    {node.long_name || "Unknown"} <br/>
                    <small style={{ color: "#64748b", fontWeight: "bold" }}>{node.short_name}</small>
                  </div>
                </td>
                <td style={{ padding: "15px", textTransform: "capitalize", fontWeight: "bold" }}>{node.role}</td>
                <td style={{ padding: "15px" }}>
                  <span style={{ color: node.is_approved ? "green" : "red", fontWeight: "bold" }}>
                    {node.is_approved ? "Approved" : "Blocked"}
                  </span>
                </td>
                <td style={{ padding: "15px" }}>
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    <button onClick={() => handleEditClick(node)} style={{ padding: "6px 12px", cursor: "pointer" }}>Edit</button>
                    <button onClick={() => handleViewLogs(node.node_id)} style={{ padding: "6px 12px", cursor: "pointer" }}>Logs</button>
                    <button onClick={() => handleDelete(node.node_id)} style={{ padding: "6px 12px", cursor: "pointer", backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #f87171" }}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* EDIT MODAL */}
      {editingNode && (
        <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", backgroundColor: "white", padding: "30px", borderRadius: "12px", zIndex: 1000, boxShadow: "0 10px 25px rgba(0,0,0,0.2)", width: "400px" }}>
          <h3>Edit Node: <span style={{ color: "#38bdf8" }}>{editingNode}</span></h3>
          <form onSubmit={handleSaveConfig} style={{ display: "flex", flexDirection: "column", gap: "15px", marginTop: "15px" }}>
            <label>Name: <input type="text" value={formData.long_name} onChange={e => setFormData({...formData, long_name: e.target.value})} style={{ width: "100%", padding: "8px", marginTop: "5px" }} /></label>
            <label>Label (4 char): <input type="text" maxLength="4" value={formData.short_name} onChange={e => setFormData({...formData, short_name: e.target.value.toUpperCase()})} style={{ width: "100%", padding: "8px", marginTop: "5px" }} /></label>
            
            <label>Role: 
              <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} style={{ width: "100%", padding: "8px", marginTop: "5px" }}>
                <option value="tracker">Tracker (Live Map)</option>
                <option value="sensor">Sensor (Sensor Dashboard)</option>
                <option value="chatter">Chatter (Messaging Only)</option>
              </select>
            </label>

            {/* NEW: Map Color Dropdown */}
            <label>Map Color: 
              <select value={formData.color} onChange={e => setFormData({...formData, color: e.target.value})} style={{ width: "100%", padding: "8px", marginTop: "5px", backgroundColor: formData.color, color: formData.color === "#fde047" ? "black" : "white", fontWeight: "bold" }}>
                <option value="#38bdf8" style={{backgroundColor: "white", color: "black"}}>Blue (Default)</option>
                <option value="#ef4444" style={{backgroundColor: "white", color: "black"}}>Red</option>
                <option value="#22c55e" style={{backgroundColor: "white", color: "black"}}>Green</option>
                <option value="#a855f7" style={{backgroundColor: "white", color: "black"}}>Purple</option>
                <option value="#f97316" style={{backgroundColor: "white", color: "black"}}>Orange</option>
                <option value="#fde047" style={{backgroundColor: "white", color: "black"}}>Yellow</option>
                <option value="#64748b" style={{backgroundColor: "white", color: "black"}}>Gray</option>
              </select>
            </label>
            
            <label style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "10px", fontWeight: "bold" }}>
              <input type="checkbox" checked={formData.is_approved} onChange={e => setFormData({...formData, is_approved: e.target.checked})} style={{ width: "18px", height: "18px" }} /> 
              Approved on Network
            </label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
              <button type="button" onClick={() => setEditingNode(null)} style={{ padding: "8px 16px" }}>Cancel</button>
              <button type="submit" style={{ padding: "8px 16px", backgroundColor: "#38bdf8", color: "white", border: "none", borderRadius: "4px" }}>Save</button>
            </div>
          </form>
        </div>
      )}

      {/* LOGS MODAL OMITTED FOR BREVITY, LEAVE YOUR EXISTING LOGS MODAL CODE HERE */}
      {viewingLogs && (
         <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", backgroundColor: "white", padding: "30px", borderRadius: "12px", zIndex: 1000, boxShadow: "0 10px 25px rgba(0,0,0,0.2)", maxHeight: "80vh", width: "500px", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #ccc", paddingBottom: "10px" }}>
            <h3 style={{ margin: 0 }}>Logs: {viewingLogs}</h3>
            <button onClick={() => setViewingLogs(null)} style={{ cursor: "pointer", padding: "5px 10px" }}>Close</button>
          </div>
          <div style={{ overflowY: "auto", flex: 1, marginTop: "10px" }}>
            {logsData.length === 0 ? <p>No telemetry logs found.</p> : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {logsData.map((log, i) => (
                  <li key={i} style={{ borderBottom: "1px solid #eee", padding: "10px 0", fontSize: "0.9em" }}>
                    <div style={{ color: "#64748b", marginBottom: "4px" }}>{new Date(log.timestamp).toLocaleString()}</div>
                    <strong>🔋 {log.battery_level}%</strong> | ⚡ {log.voltage}V | 🌡️ {log.temperature}°C
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}