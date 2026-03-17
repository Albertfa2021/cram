'use strict';

const WebSocket = require('ws');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [WebSocket] ${level}: ${message}`;
    })
  ),
  transports: [new winston.transports.Console()]
});

class WebSocketServer {
  constructor(config, tcpClient, grpcClient) {
    this.config = config;
    this.tcpClient = tcpClient;
    this.grpcClient = grpcClient || null;
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

        case 'STOP_STREAM':
          this.handleStopStream(ws);
          break;

        case 'START_ROTATE_TEST':
          this.handleStartRotateTest(ws, data.payload);
          break;

        case 'GET_GRPC_STATUS':
          this.handleGetGrpcStatus(ws);
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
   * Handle SEND_DATA command.
   * Routes to gRPC streaming when a gRPC client is available,
   * falls back to TCP otherwise.
   */
  handleSendData(ws, payload) {
    if (this.grpcClient) {
      try {
        const directPathOnly = payload.directPathOnly === true;
        logger.info(`Starting gRPC stream for solver: ${payload.solverUUID}${directPathOnly ? ' [directPathOnly]' : ''}`);
        this.grpcClient.startStream(payload.data, directPathOnly);
        this.sendToClient(ws, {
          type: 'GRPC_STREAM_STARTED',
          payload: { status: 'streaming' }
        });
      } catch (error) {
        logger.error(`gRPC stream start failed: ${error.message}`);
        this.sendToClient(ws, {
          type: 'ERROR',
          payload: { message: `gRPC stream error: ${error.message}` }
        });
      }
    } else {
      this.handleSendDataTCP(ws, payload);
    }
  }

  /**
   * Handle START_ROTATE_TEST command — generate synthetic rotation frames.
   */
  handleStartRotateTest(ws, payload) {
    if (!this.grpcClient) {
      this.sendToClient(ws, {
        type: 'ERROR',
        payload: { message: 'No gRPC client configured' }
      });
      return;
    }

    try {
      const config = payload || {};
      logger.info(
        `Starting rotation test: radius=${config.radius ?? 2.0}m ` +
        `steps=${config.steps ?? 12} framesPerStep=${config.framesPerStep ?? 25}`
      );

      const result = this.grpcClient.startRotationTest(config);

      this.broadcast({
        type: 'ROTATE_TEST_STARTED',
        payload: {
          totalFrames: result.totalFrames,
          totalSteps: result.totalSteps,
          startSeq: result.startSeq
        }
      });

      // Notify when the child process completes — poll streaming flag
      const pollInterval = setInterval(() => {
        if (!this.grpcClient.streaming) {
          clearInterval(pollInterval);
          this.broadcast({ type: 'ROTATE_TEST_COMPLETE', payload: {} });
        }
      }, 500);
    } catch (error) {
      logger.error(`Rotation test start failed: ${error.message}`);
      this.sendToClient(ws, {
        type: 'ERROR',
        payload: { message: `Rotation test error: ${error.message}` }
      });
    }
  }

  /**
   * Handle STOP_STREAM command — stop gRPC streaming.
   */
  handleStopStream(ws) {
    if (this.grpcClient) {
      this.grpcClient.stopStream();
      this.sendToClient(ws, { type: 'GRPC_STREAM_STOPPED' });
    } else {
      this.sendToClient(ws, {
        type: 'ERROR',
        payload: { message: 'No gRPC client configured' }
      });
    }
  }

  /**
   * Handle GET_GRPC_STATUS command.
   */
  handleGetGrpcStatus(ws) {
    if (this.grpcClient) {
      this.sendToClient(ws, {
        type: 'GRPC_STATUS',
        payload: this.grpcClient.getStatus()
      });
    } else {
      this.sendToClient(ws, {
        type: 'GRPC_STATUS',
        payload: { connected: false, streaming: false, frameSeq: 0, ackCount: 0, queueDepth: 0 }
      });
    }
  }

  /**
   * Legacy TCP transmission path.
   */
  async handleSendDataTCP(ws, payload) {
    try {
      logger.info(`Transmitting data via TCP for solver: ${payload.solverUUID}`);
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
      logger.error(`TCP transmission failed: ${error.message}`);
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
    const grpcStatus = this.grpcClient ? this.grpcClient.getStatus() : null;
    // When gRPC client is configured it acts as the primary transport.
    // Report tcpConnected=true so the frontend "Send to Network" button is enabled.
    const transportReady = this.grpcClient !== null || tcpStatus.connected;
    return {
      wsConnected: true,
      tcpConnected: transportReady,
      tcpConnecting: !transportReady && tcpStatus.connecting,
      tcpHost: tcpStatus.host,
      tcpPort: tcpStatus.port,
      reconnectAttempts: tcpStatus.reconnectAttempts,
      queuedMessages: tcpStatus.queuedMessages,
      grpc: grpcStatus
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
