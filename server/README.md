# CRAM Network Server

TCP/WebSocket bridge server for transmitting Image Source data from CRAM browser application to target LAN servers.

## Architecture

```
Browser (React SPA)
    ↕ WebSocket (ws://localhost:3001)
Node.js Backend Server
    ↕ TCP Socket (configurable IP:Port)
Target LAN Server
```

## Installation

```bash
cd server
npm install
```

Or from the project root:

```bash
npm run server:install
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
# WebSocket server (Browser ↔ Backend)
WS_PORT=3001
WS_HOST=localhost

# TCP client (Backend ↔ Target Server)
TCP_HOST=192.168.1.100
TCP_PORT=5000
TCP_RECONNECT_DELAY=1000
TCP_MAX_RECONNECT_DELAY=30000
TCP_MAX_RECONNECT_ATTEMPTS=10
TCP_CONNECTION_TIMEOUT=5000

# Logging
LOG_LEVEL=info
```

## Usage

### Start the server

```bash
npm start
```

Or from the project root:

```bash
npm run server:start
```

### Development mode (with auto-reload)

```bash
npm run dev
```

Or from the project root:

```bash
npm run server:dev
```

### Testing with mock TCP server

```bash
npm run test
```

Or from the project root:

```bash
npm run server:test
```

The mock server listens on port 5000 by default. You can specify a different port:

```bash
node test/mock-tcp-server.js --port 6000
```

## TCP Message Protocol

The server uses length-prefixed framing for TCP messages:

```
[4-byte Big-Endian Length][JSON Payload]
```

Example:
- Length: `0x00000123` (291 bytes)
- Payload: `{"metadata":{...},"rayPaths":[...]}`

## WebSocket Commands

### Browser → Server

- **SEND_DATA**: Transmit JSON data to TCP server
  ```json
  {
    "type": "SEND_DATA",
    "payload": {
      "solverUUID": "...",
      "data": { ... },
      "timestamp": "2025-01-29T..."
    }
  }
  ```

- **UPDATE_CONFIG**: Change TCP target IP/Port
  ```json
  {
    "type": "UPDATE_CONFIG",
    "payload": {
      "tcpHost": "192.168.1.100",
      "tcpPort": 5000
    }
  }
  ```

- **CONNECT**: Initiate TCP connection
  ```json
  { "type": "CONNECT" }
  ```

- **DISCONNECT**: Close TCP connection
  ```json
  { "type": "DISCONNECT" }
  ```

- **GET_STATUS**: Request current connection status
  ```json
  { "type": "GET_STATUS" }
  ```

### Server → Browser

- **STATUS_UPDATE**: Connection state notification
  ```json
  {
    "type": "STATUS_UPDATE",
    "payload": {
      "wsConnected": true,
      "tcpConnected": true,
      "tcpHost": "192.168.1.100",
      "tcpPort": 5000,
      "reconnectAttempts": 0,
      "queuedMessages": 0
    }
  }
  ```

- **TRANSMISSION_COMPLETE**: Data transmission result
  ```json
  {
    "type": "TRANSMISSION_COMPLETE",
    "payload": {
      "success": true,
      "bytesTransmitted": 4523,
      "timestamp": "2025-01-29T...",
      "error": null
    }
  }
  ```

- **ERROR**: Error notification
  ```json
  {
    "type": "ERROR",
    "payload": {
      "message": "Connection failed"
    }
  }
  ```

## Features

### Auto-Reconnection
- Exponential backoff (1s → 30s)
- Max 10 attempts
- Automatic retry on connection loss

### Message Queueing
- Failed messages are queued
- Auto-retry when connection restored
- Queue status visible in UI

### Connection Management
- Real-time status updates
- Manual connect/disconnect
- Graceful shutdown

## Testing Workflow

1. **Start mock TCP server:**
   ```bash
   cd server/test
   node mock-tcp-server.js --port 5000
   ```

2. **Start backend server:**
   ```bash
   cd server
   npm start
   ```

3. **Start CRAM frontend:**
   ```bash
   npm start
   ```

4. **In CRAM UI:**
   - Configure TCP server: `127.0.0.1:5000`
   - Click "Connect to Server"
   - Run Image Source calculation
   - Click "Send to Network"

5. **Verify in mock server console:**
   - Should display received JSON data
   - Shows message metadata

## Troubleshooting

### WebSocket connection fails
- Check backend server is running
- Verify port 3001 is not in use
- Check browser console for errors

### TCP connection fails
- Verify target server is running
- Check IP address and port
- Ensure firewall allows connection
- Review backend server logs

### Data not transmitting
- Verify both WebSocket and TCP are connected
- Check for queued messages in UI
- Review backend logs for errors

## Production Deployment

### As Windows Service
Use tools like `node-windows` or `nssm` to run as a service.

### As Linux Service (systemd)
Create `/etc/systemd/system/cram-network.service`:

```ini
[Unit]
Description=CRAM Network Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/cram/server
ExecStart=/usr/bin/node index.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

### With Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3001
CMD ["node", "index.js"]
```

## Security Considerations

- WebSocket uses localhost only (development)
- Add authentication for production
- Validate all incoming data
- Use TLS/SSL for production WebSocket (WSS)
- Consider firewall rules for TCP connections

## License

MIT
