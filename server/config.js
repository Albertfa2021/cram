const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const config = {
  // WebSocket server configuration
  ws: {
    port: parseInt(process.env.WS_PORT || '3001', 10),
    host: process.env.WS_HOST || 'localhost'
  },

  // TCP client configuration (mutable at runtime)
  tcp: {
    host: process.env.TCP_HOST || '127.0.0.1',
    port: parseInt(process.env.TCP_PORT || '5000', 10),
    reconnectDelay: parseInt(process.env.TCP_RECONNECT_DELAY || '1000', 10),
    maxReconnectDelay: parseInt(process.env.TCP_MAX_RECONNECT_DELAY || '30000', 10),
    maxReconnectAttempts: parseInt(process.env.TCP_MAX_RECONNECT_ATTEMPTS || '10', 10),
    connectionTimeout: parseInt(process.env.TCP_CONNECTION_TIMEOUT || '5000', 10)
  },

  // gRPC / ts_auralization_controller configuration (CRAM → SAPF)
  grpc: {
    endpoint: process.env.GRPC_ENDPOINT || '127.0.0.1:50051',
    instanceId: process.env.GRPC_INSTANCE_ID || '',
    frameIntervalMs: parseInt(process.env.GRPC_FRAME_INTERVAL_MS || '20', 10),
    // ts_auralization_controller: path to compiled dist/main.js
    tsControllerPath: process.env.TS_CONTROLLER_PATH ||
      path.resolve(__dirname, '../../sapf/examples/ts_auralization_controller/dist/main.js'),
    // number of replay frames per session (default 300 = 6 s @ 20 ms)
    replayFrames: parseInt(process.env.TS_CONTROLLER_FRAMES || '300', 10)
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info'
  }
};

module.exports = config;
