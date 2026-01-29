const WebSocket = require('ws');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [WebSocket] ${level}: ${message}`;
    })
  ),
  transports: [new winston.transports.Console()]
});

class WebSocketServer {
  constructor(config, tcpClient) {
    this.config = config;
    this.tcpClient = tcpClient;
    this.wss = null;
    this.clients = new Set();

    // Bind TCP client event handlers
    this.setupTCPEventHandlers();
  }

  /**
   * Start WebSocket server
   */
  start() {
    this.wss = new WebSocket.Server({
      host: this.config.ws.host,
      port: this.config.ws.port
    });

    this.wss.on('connection', (ws) => {
      logger.info('Browser client connected');
      this.clients.add(ws);

      // Send initial status
      this.sendToClient(ws, {
        type: 'STATUS_UPDATE',
        payload: this.getFullStatus()
      });

      ws.on('message', (message) => {
        this.handleClientMessage(ws, message);
      });

      ws.on('close', () => {
        logger.info('Browser client disconnected');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        logger.error(`WebSocket error: ${error.message}`);
        this.clients.delete(ws);
      });
    });

    logger.info(`WebSocket server listening on ${this.config.ws.host}:${this.config.ws.port}`);
  }

  /**
   * Handle incoming messages from browser
   */
  handleClientMessage(ws, message) {
    try {
      const data = JSON.parse(message);
      logger.debug(`Received command: ${data.type}`);

      switch (data.type) {
        case 'SEND_DATA':
          this.handleSendData(ws, data.payload);
          break;

        case 'UPDATE_CONFIG':
          this.handleUpdateConfig(ws, data.payload);
          break;

        case 'GET_STATUS':
          this.handleGetStatus(ws);
          break;

        case 'CONNECT':
          this.handleConnect(ws);
          break;

        case 'DISCONNECT':
          this.handleDisconnect(ws);
          break;

        default:
          logger.warn(`Unknown command type: ${data.type}`);
          this.sendToClient(ws, {
            type: 'ERROR',
            payload: { message: `Unknown command: ${data.type}` }
          });
      }
    } catch (error) {
      logger.error(`Error parsing client message: ${error.message}`);
      this.sendToClient(ws, {
        type: 'ERROR',
        payload: { message: 'Invalid message format' }
      });
    }
  }

  /**
   * Handle SEND_DATA command
   */
  async handleSendData(ws, payload) {
    try {
      logger.info(`Transmitting data for solver: ${payload.solverUUID}`);
      const result = await this.tcpClient.send(payload.data);

      this.broadcast({
        type: 'TRANSMISSION_COMPLETE',
        payload: {
          success: true,
          bytesTransmitted: result.bytesTransmitted,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error(`Transmission failed: ${error.message}`);
      this.broadcast({
        type: 'TRANSMISSION_COMPLETE',
        payload: {
          success: false,
          bytesTransmitted: 0,
          timestamp: new Date().toISOString(),
          error: error.message
        }
      });
    }
  }

  /**
   * Handle UPDATE_CONFIG command
   */
  handleUpdateConfig(ws, payload) {
    const { tcpHost, tcpPort } = payload;
    logger.info(`Updating TCP config: ${tcpHost}:${tcpPort}`);
    this.tcpClient.updateConfig(tcpHost, tcpPort);
    this.broadcastStatus();
  }

  /**
   * Handle GET_STATUS command
   */
  handleGetStatus(ws) {
    this.sendToClient(ws, {
      type: 'STATUS_UPDATE',
      payload: this.getFullStatus()
    });
  }

  /**
   * Handle CONNECT command
   */
  handleConnect(ws) {
    logger.info('Browser requested TCP connection');
    this.tcpClient.connect();
  }

  /**
   * Handle DISCONNECT command
   */
  handleDisconnect(ws) {
    logger.info('Browser requested TCP disconnection');
    this.tcpClient.disconnect();
  }

  /**
   * Setup TCP client event handlers
   */
  setupTCPEventHandlers() {
    this.tcpClient.on('connected', () => {
      this.broadcastStatus();
    });

    this.tcpClient.on('disconnected', () => {
      this.broadcastStatus();
    });

    this.tcpClient.on('reconnecting', ({ attempt, delay }) => {
      this.broadcast({
        type: 'STATUS_UPDATE',
        payload: {
          ...this.getFullStatus(),
          reconnecting: true,
          reconnectAttempt: attempt,
          reconnectDelay: delay
        }
      });
    });

    this.tcpClient.on('reconnect_failed', () => {
      this.broadcast({
        type: 'ERROR',
        payload: { message: 'TCP reconnection failed after maximum attempts' }
      });
      this.broadcastStatus();
    });
  }

  /**
   * Get full status including WebSocket and TCP
   */
  getFullStatus() {
    const tcpStatus = this.tcpClient.getStatus();
    return {
      wsConnected: true,
      tcpConnected: tcpStatus.connected,
      tcpConnecting: tcpStatus.connecting,
      tcpHost: tcpStatus.host,
      tcpPort: tcpStatus.port,
      reconnectAttempts: tcpStatus.reconnectAttempts,
      queuedMessages: tcpStatus.queuedMessages
    };
  }

  /**
   * Broadcast status update to all clients
   */
  broadcastStatus() {
    this.broadcast({
      type: 'STATUS_UPDATE',
      payload: this.getFullStatus()
    });
  }

  /**
   * Send message to specific client
   */
  sendToClient(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(message) {
    const messageStr = JSON.stringify(message);
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }

  /**
   * Stop WebSocket server
   */
  stop() {
    if (this.wss) {
      this.wss.close();
      logger.info('WebSocket server stopped');
    }
  }
}

module.exports = WebSocketServer;
