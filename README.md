# 📡 Meshtastic Private Network Manager

A full-stack, real-time web dashboard for managing a closed-loop, private LoRa mesh network. 

Unlike standard public Meshtastic setups, this architecture uses an **MQTT Gateway**, **AES-256 private channels**, and a **strict database allowlist** to create a secure, enrolled-only enterprise or advanced-hobbyist network. 

![Project Status](https://img.shields.io/badge/Status-Active-success)
![Hardware](https://img.shields.io/badge/Hardware-Meshtastic_LoRa-blue)
![Backend](https://img.shields.io/badge/Backend-FastAPI_|_Python-green)
![Frontend](https://img.shields.io/badge/Frontend-React_|_Vite-cyan)
![Deployment](https://img.shields.io/badge/Deployment-Docker-2496ED)

---

## 🏗️ System Architecture

The system bridges physical LoRa radio waves with a modern, real-time web application:
1. **Edge (LoRa Mesh):** Remote nodes encrypt and broadcast GPS, telemetry, and text data using a private AES-256 key on a custom channel.
2. **Gateway Node:** A dedicated WiFi-enabled Meshtastic node receives the radio packets, decrypts them, and forwards them as JSON to a local MQTT broker over your LAN.
3. **Infrastructure (Docker & Mosquitto):** A containerized MQTT broker routes the live JSON stream.
4. **Backend (FastAPI + SQLite):** An asynchronous Python worker intercepts the MQTT data for your specific private channel, checks the sender against the database allowlist, logs the data, and broadcasts it over WebSockets.
5. **Frontend (React + Nginx):** The web dashboard consumes the REST API for historical data and the WebSocket for real-time, zero-refresh UI updates, including interactive hover-tooltips.

---

## ✨ Core Features

* **🗺️ Live Map Tracking & Tooltips:** View the real-time physical location of all approved nodes on an interactive map. Hover over any node to see a live telemetry summary and its last-heard timestamp.
* **📍 Stationary Sensor Mapping:** Not all sensors have GPS. Use the embedded Map Picker in the Admin UI to permanently anchor stationary environmental sensors to fixed coordinates on your map.
* **💬 Network Messaging:** A two-way chat interface allowing the web dashboard to broadcast text messages directly to field nodes via the LoRa mesh.
* **⚙️ Strict Device Management:** Gatekeep network access. View all nodes attempting to communicate on the channel, approve/block them, assign them 4-character map labels, and remotely push configuration changes over the airwaves.

---

## 🔐 Setting Up Your Private Mesh Channel

To ensure your network completely ignores public chatter and only processes your own sensors and trackers, you must configure a private channel and link it to your backend.

### 1. Create the Secure Channel
Using the Meshtastic mobile app connected to your primary "Admin" node via Bluetooth:
1. Navigate to the **Channels** tab.
2. Select an unused channel slot (e.g., Channel 1).
3. Name the channel something unique (e.g., `MyPriv`).
4. Generate a new **256-bit AES Encryption Key** (PSK). 

### 2. Enroll Trackers and Sensors
Your other nodes (trackers, environmental sensors) need this exact key to join your network.
1. In the Meshtastic app, tap the **Share** button next to your new private channel.
2. This generates a **QR Code**. 
3. Open the Meshtastic app for your other nodes and use the camera to scan this QR code. They are now securely enrolled in your private mesh!

### 3. Configure the MQTT Gateway Node
Your Gateway Node must be enrolled in this private channel to decode the traffic.
1. Scan the QR code with your Gateway Node.
2. Go to the **Channels** tab and select your private channel (`MyPriv`).
3. Scroll down to **Module Settings**.
4. Toggle **Uplink Enabled** and **Downlink Enabled** to **ON**. *(Note: Turn these OFF for the default `LongFast` channel so you don't forward public internet traffic).*

### 4. Link the Channel to the Python Backend
Finally, tell your FastAPI backend to only listen to data arriving on this specific channel.
1. Open `meshtastic-backend/main.py`.
2. Locate the `MQTT_TOPIC` variable at the top of the file.
3. Update it to match your exact channel name. For example, if your channel is named `MyPriv`, the topic must be:

   ```python
   MQTT_TOPIC = "msh/2/json/MyPriv/#"
   ```

---

## 🚀 Deployment (Docker Compose)
This entire stack is containerized for instant, consistent deployment across macOS, Linux, or Raspberry Pi.

### 1. Hardware Prerequisites
At least two Meshtastic devices.

One device must be WiFi/Ethernet-enabled to act as the Gateway Node.

A host machine with Docker installed.

### 2. Update Environment Variables
Before building the containers, ensure the code points to your production environment:

In `meshtastic-frontend/src/components/*`, update any localhost fetch/WebSocket URLs to the actual IP address of your host machine (e.g., 192.168.1.50) so external devices like your smartphone can access the API.

### 3. Boot the Stack
Navigate to the root directory containing your docker-compose.yml and run:

```bash
docker-compose up -d --build
```

The application will automatically pull the required images, build the React frontend, and spin up Nginx, FastAPI, and Mosquitto. Access the dashboard by navigating to http://<your-host-ip> in any web browser.

---

## 🛡️ Admin Allowlist

Even with AES-256 encryption, this application uses a strict database allowlist for a second layer of security. When a newly enrolled physical node sends its first packet on your private channel, it will appear in the web dashboard's Device Management table as Blocked. You must click Configure and check the Approved box before its GPS, telemetry, or chat data will be processed by the system.