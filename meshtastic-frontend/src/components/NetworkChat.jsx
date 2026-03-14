import React, { useState, useEffect, useRef } from 'react';

export default function NetworkChat() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [nodes, setNodes] = useState({});
  const messagesEndRef = useRef(null);

  // 1. Fetch Approved Nodes & Chat History
  useEffect(() => {
    async function loadData() {
      try {
        const nodeRes = await fetch("http://localhost:8000/api/nodes");
        const nodeData = await nodeRes.json();
        const nodeMap = {};
        nodeData.forEach(n => { nodeMap[n.node_id] = n.long_name || n.short_name || n.node_id; });
        setNodes(nodeMap);

        const msgRes = await fetch("http://localhost:8000/api/messages");
        setMessages(await msgRes.json());
      } catch (err) {
        console.error("Failed to load chat data", err);
      }
    }
    loadData();
  }, []);

  // 2. Listen for Real-Time Messages
  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8000/ws");
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.event === "text_message") {
        setMessages(prev => [...prev, {
          sender_node_id: data.sender_node_id,
          text_payload: data.text_payload,
          timestamp: data.timestamp
        }]);
      }
    };
    return () => ws.close();
  }, []);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 3. Send Message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    try {
      await fetch("http://localhost:8000/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          sender_node_id: "WebAdmin",   // Matches your schema
          receiver_node_id: "^all",     // Matches your schema (broadcast)
          text_payload: inputText       // Matches your schema
        })
      });
      setInputText(""); // Clear input box
    } catch (err) {
      console.error("Failed to send message", err);
    }
  };

  return (
    <div style={{ padding: "30px", maxWidth: "800px", margin: "0 auto", height: "calc(100vh - 60px)", display: "flex", flexDirection: "column" }}>
      <h2 style={{ borderBottom: "2px solid #e2e8f0", paddingBottom: "10px", margin: "0 0 20px 0" }}>Network Chat</h2>
      
      {/* Chat History Window */}
      <div style={{ flex: 1, backgroundColor: "white", borderRadius: "12px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)", border: "1px solid #e2e8f0", padding: "20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "15px" }}>
        {messages.length === 0 ? (
          <p style={{ textAlign: "center", color: "#64748b", marginTop: "auto", marginBottom: "auto" }}>No messages on the network yet.</p>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.sender_node_id === "WebAdmin";
            return (
              <div key={idx} style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
                <span style={{ fontSize: "0.8em", color: "#64748b", marginBottom: "4px", marginLeft: "4px", marginRight: "4px" }}>
                  {isMe ? "Admin (You)" : (nodes[msg.sender_node_id] || msg.sender_node_id)} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <div style={{ 
                  backgroundColor: isMe ? "#38bdf8" : "#f1f5f9", 
                  color: isMe ? "white" : "#0f172a", 
                  padding: "12px 16px", 
                  borderRadius: "18px", 
                  borderBottomRightRadius: isMe ? "4px" : "18px",
                  borderBottomLeftRadius: !isMe ? "4px" : "18px",
                  maxWidth: "75%",
                  lineHeight: "1.4",
                  wordWrap: "break-word"
                }}>
                  {msg.text_payload}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Field */}
      <form onSubmit={handleSendMessage} style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
        <input 
          type="text" 
          value={inputText} 
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Broadcast a message to the mesh..." 
          style={{ flex: 1, padding: "15px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "1em", outline: "none" }} 
        />
        <button type="submit" style={{ padding: "0 25px", backgroundColor: "#38bdf8", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", fontSize: "1em" }}>
          Send
        </button>
      </form>
    </div>
  );
}