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

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info'
  }
};

module.exports = config;
