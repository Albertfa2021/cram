const config = require('./config');
const TCPClient = require('./tcp-client');
const WebSocketServer = require('./websocket-server');

// Initialize TCP client
const tcpClient = new TCPClient(config);

// Initialize WebSocket server
const wsServer = new WebSocketServer(config, tcpClient);

// Start WebSocket server
wsServer.start();

// Auto-connect to TCP server on startup (optional)
// Uncomment the following line to enable auto-connect:
// tcpClient.connect();

console.log('CRAM Network Server started');
console.log(`WebSocket server: ws://${config.ws.host}:${config.ws.port}`);
console.log(`TCP target: ${config.tcp.host}:${config.tcp.port}`);
console.log('Waiting for browser connection...');

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  tcpClient.disconnect();
  wsServer.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down gracefully...');
  tcpClient.disconnect();
  wsServer.stop();
  process.exit(0);
});
