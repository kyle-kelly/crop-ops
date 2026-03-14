// src/hooks/useMeshtasticSocket.js
import { useState, useEffect } from 'react';

export function useMeshtasticSocket(url) {
  const [latestEvent, setLatestEvent] = useState(null);

  useEffect(() => {
    const ws = new WebSocket(url);

    ws.onopen = () => console.log("✅ Connected to FastAPI WebSocket");
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("📥 Received WebSocket Data:", data);
      setLatestEvent(data);
    };

    ws.onclose = () => console.log("❌ Disconnected from WebSocket");

    return () => ws.close();
  }, [url]);

  return latestEvent;
}