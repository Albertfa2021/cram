const net = require('net');
const EventEmitter = require('events');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [TCP] ${level}: ${message}`;
    })
  ),
  transports: [new winston.transports.Console()]
});

class TCPClient extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.socket = null;
    this.connected = false;
    this.connecting = false;
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.messageQueue = [];
    this.shouldReconnect = true;
  }

  /**
   * Connect to TCP server
   */
  connect() {
    if (this.connected || this.connecting) {
      logger.warn('Already connected or connecting');
      return;
    }

    this.connecting = true;
    this.shouldReconnect = true;
    logger.info(`Connecting to ${this.config.tcp.host}:${this.config.tcp.port}`);

    this.socket = new net.Socket();
    this.socket.setTimeout(this.config.tcp.connectionTimeout);

    // Connection timeout handler
    this.socket.on('timeout', () => {
      logger.error('Connection timeout');
      this.socket.destroy();
      this.handleDisconnect(new Error('Connection timeout'));
    });

    // Connection established
    this.socket.on('connect', () => {
      this.connecting = false;
      this.connected = true;
      this.reconnectAttempts = 0;
      logger.info('TCP connection established');
      this.emit('connected');
      this.socket.setTimeout(0); // Disable timeout after connection
      this.processQueue();
    });

    // Data received
    this.socket.on('data', (data) => {
      logger.debug(`Received ${data.length} bytes from server`);
      this.emit('data', data);
    });

    // Connection closed
    this.socket.on('close', () => {
      logger.info('TCP connection closed');
      this.handleDisconnect(new Error('Connection closed by server'));
    });

    // Error handling
    this.socket.on('error', (err) => {
      logger.error(`TCP socket error: ${err.message}`);
      this.handleDisconnect(err);
    });

    // Initiate connection
    this.socket.connect(this.config.tcp.port, this.config.tcp.host);
  }

  /**
   * Disconnect from TCP server
   */
  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.connected = false;
    this.connecting = false;
    logger.info('Disconnected from TCP server');
    this.emit('disconnected');
  }

  /**
   * Handle disconnection and initiate reconnection
   */
  handleDisconnect(error) {
    const wasConnected = this.connected;
    this.connected = false;
    this.connecting = false;

    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }

    if (wasConnected) {
      this.emit('disconnected', error);
    }

    if (!this.shouldReconnect) {
      return;
    }

    // Exponential backoff reconnection
    if (this.reconnectAttempts < this.config.tcp.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(
        this.config.tcp.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
        this.config.tcp.maxReconnectDelay
      );
      logger.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.config.tcp.maxReconnectAttempts})`);
      this.emit('reconnecting', { attempt: this.reconnectAttempts, delay });
      this.reconnectTimer = setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      logger.error('Max reconnection attempts reached');
      this.emit('reconnect_failed');
    }
  }

  /**
   * Send data with length-prefix framing
   * Frame format: [4-byte Big-Endian length][JSON payload]
   */
  send(data) {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        logger.warn('Not connected, queueing message');
        this.messageQueue.push({ data, resolve, reject });
        return;
      }

      try {
        const jsonString = JSON.stringify(data);
        const jsonBuffer = Buffer.from(jsonString, 'utf8');
        const length = jsonBuffer.length;

        // Create length prefix (4 bytes, Big-Endian)
        const lengthBuffer = Buffer.allocUnsafe(4);
        lengthBuffer.writeUInt32BE(length, 0);

        // Combine length prefix and payload
        const message = Buffer.concat([lengthBuffer, jsonBuffer]);

        logger.info(`Sending ${length} bytes to TCP server`);
        logger.debug(`Payload: ${jsonString.substring(0, 100)}...`);

        this.socket.write(message, (err) => {
          if (err) {
            logger.error(`Failed to send data: ${err.message}`);
            this.messageQueue.push({ data, resolve, reject });
            reject(err);
          } else {
            logger.info('Data transmitted successfully');
            resolve({ success: true, bytesTransmitted: message.length });
          }
        });
      } catch (error) {
        logger.error(`Error preparing message: ${error.message}`);
        reject(error);
      }
    });
  }

  /**
   * Process queued messages
   */
  processQueue() {
    if (this.messageQueue.length === 0) {
      return;
    }

    logger.info(`Processing ${this.messageQueue.length} queued messages`);
    const queue = [...this.messageQueue];
    this.messageQueue = [];

    queue.forEach(({ data, resolve, reject }) => {
      this.send(data).then(resolve).catch(reject);
    });
  }

  /**
   * Update TCP server configuration
   */
  updateConfig(host, port) {
    const needsReconnect = this.connected && (
      host !== this.config.tcp.host ||
      port !== this.config.tcp.port
    );

    this.config.tcp.host = host;
    this.config.tcp.port = port;
    logger.info(`Configuration updated: ${host}:${port}`);

    if (needsReconnect) {
      logger.info('Configuration changed, reconnecting...');
      this.disconnect();
      setTimeout(() => this.connect(), 500);
    }
  }

  /**
   * Get current connection status
   */
  getStatus() {
    return {
      connected: this.connected,
      connecting: this.connecting,
      host: this.config.tcp.host,
      port: this.config.tcp.port,
      reconnectAttempts: this.reconnectAttempts,
      queuedMessages: this.messageQueue.length
    };
  }
}

module.exports = TCPClient;
