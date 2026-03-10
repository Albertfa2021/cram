'use strict';

const config = require('./config');
const TCPClient = require('./tcp-client');
const WebSocketServer = require('./websocket-server');
const ReplayRunner = require('./replay-runner');

// Initialize TCP client (legacy path, kept for fallback)
const tcpClient = new TCPClient(config);

// Initialize replay runner (primary path: CRAM → ts_auralization_controller → SAPF)
let replayRunner = null;
try {
  replayRunner = new ReplayRunner(config);
} catch (err) {
  console.error(`[ReplayRunner] Failed to initialize: ${err.message}`);
  console.warn('[ReplayRunner] Server will start without gRPC support (TCP fallback active)');
}

// Initialize WebSocket server
const wsServer = new WebSocketServer(config, tcpClient, replayRunner);

// Start WebSocket server
wsServer.start();

console.log('CRAM Network Server started');
console.log(`WebSocket server: ws://${config.ws.host}:${config.ws.port}`);
console.log(`TCP target: ${config.tcp.host}:${config.tcp.port}`);
console.log(`gRPC endpoint: ${config.grpc.endpoint}`);
console.log('Waiting for browser connection...');

// Graceful shutdown
function shutdown() {
  console.log('\nShutting down gracefully...');
  if (replayRunner) {
    replayRunner.disconnect();
  }
  tcpClient.disconnect();
  wsServer.stop();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
