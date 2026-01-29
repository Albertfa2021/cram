import { emit } from '../messenger';
import { useNetwork } from './network-store';

type WebSocketMessage =
  | { type: 'STATUS_UPDATE'; payload: any }
  | { type: 'TRANSMISSION_COMPLETE'; payload: any }
  | { type: 'ERROR'; payload: any };

class NetworkService {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private shouldReconnect = true;

  constructor() {
    this.connect = this.connect.bind(this);
    this.disconnect = this.disconnect.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
    this.handleOpen = this.handleOpen.bind(this);
    this.handleClose = this.handleClose.bind(this);
    this.handleError = this.handleError.bind(this);
  }

  /**
   * Connect to WebSocket server
   */
  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      console.warn('[NetworkService] Already connected or connecting');
      return;
    }

    this.shouldReconnect = true;
    const wsUrl = 'ws://localhost:3001';

    console.log(`[NetworkService] Connecting to ${wsUrl}`);
    useNetwork.getState().set((draft) => {
      draft.wsStatus = 'connecting';
    });

    try {
      this.ws = new WebSocket(wsUrl);
      this.ws.onopen = this.handleOpen;
      this.ws.onmessage = this.handleMessage;
      this.ws.onclose = this.handleClose;
      this.ws.onerror = this.handleError;
    } catch (error) {
      console.error('[NetworkService] WebSocket connection error:', error);
      this.handleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    useNetwork.getState().set((draft) => {
      draft.wsConnected = false;
      draft.wsStatus = 'disconnected';
      draft.tcpConnected = false;
      draft.tcpStatus = 'disconnected';
    });
    console.log('[NetworkService] Disconnected');
  }

  /**
   * Handle WebSocket connection opened
   */
  private handleOpen() {
    console.log('[NetworkService] WebSocket connected');
    this.reconnectAttempts = 0;
    useNetwork.getState().set((draft) => {
      draft.wsConnected = true;
      draft.wsStatus = 'connected';
      draft.errorMessage = null;
    });

    // Request initial status
    this.send({ type: 'GET_STATUS' });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(event: MessageEvent) {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      console.log('[NetworkService] Received:', message.type);

      switch (message.type) {
        case 'STATUS_UPDATE':
          this.handleStatusUpdate(message.payload);
          break;

        case 'TRANSMISSION_COMPLETE':
          this.handleTransmissionComplete(message.payload);
          break;

        case 'ERROR':
          this.handleErrorMessage(message.payload);
          break;

        default:
          console.warn('[NetworkService] Unknown message type:', message);
      }
    } catch (error) {
      console.error('[NetworkService] Error parsing message:', error);
    }
  }

  /**
   * Handle WebSocket connection closed
   */
  private handleClose() {
    console.log('[NetworkService] WebSocket closed');
    useNetwork.getState().set((draft) => {
      draft.wsConnected = false;
      draft.wsStatus = 'disconnected';
      draft.tcpConnected = false;
      draft.tcpStatus = 'disconnected';
    });

    if (this.shouldReconnect) {
      this.handleReconnect();
    }
  }

  /**
   * Handle WebSocket error
   */
  private handleError(error: Event) {
    console.error('[NetworkService] WebSocket error:', error);
    useNetwork.getState().set((draft) => {
      draft.wsStatus = 'error';
      draft.errorMessage = 'WebSocket connection error';
    });
  }

  /**
   * Handle reconnection with exponential backoff
   */
  private handleReconnect() {
    if (!this.shouldReconnect) {
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[NetworkService] Max reconnection attempts reached');
      useNetwork.getState().set((draft) => {
        draft.wsStatus = 'error';
        draft.errorMessage = 'Failed to connect to network server';
      });
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);
    console.log(`[NetworkService] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Handle status update from backend
   */
  private handleStatusUpdate(payload: any) {
    useNetwork.getState().set((draft) => {
      draft.tcpConnected = payload.tcpConnected || false;
      draft.tcpStatus = payload.tcpConnected ? 'connected' : (payload.tcpConnecting ? 'connecting' : 'disconnected');
      draft.tcpHost = payload.tcpHost || draft.tcpHost;
      draft.tcpPort = payload.tcpPort || draft.tcpPort;
      draft.reconnectAttempts = payload.reconnectAttempts || 0;
      draft.queuedMessages = payload.queuedMessages || 0;
    });

    emit('NETWORK_STATUS_UPDATE', {
      wsConnected: true,
      tcpConnected: payload.tcpConnected || false,
      tcpHost: payload.tcpHost || '',
      tcpPort: payload.tcpPort || 0
    });
  }

  /**
   * Handle transmission complete notification
   */
  private handleTransmissionComplete(payload: any) {
    useNetwork.getState().set((draft) => {
      draft.transmissionInProgress = false;
      draft.lastTransmissionTime = payload.timestamp;
      draft.lastTransmissionStatus = payload.success ? 'success' : 'failed';
      draft.lastBytesTransmitted = payload.bytesTransmitted || 0;
      draft.errorMessage = payload.error || null;
    });

    emit('NETWORK_TRANSMISSION_COMPLETE', {
      success: payload.success,
      bytesTransmitted: payload.bytesTransmitted || 0,
      timestamp: payload.timestamp,
      error: payload.error
    });
  }

  /**
   * Handle error message from backend
   */
  private handleErrorMessage(payload: any) {
    useNetwork.getState().set((draft) => {
      draft.errorMessage = payload.message || 'Unknown error';
    });
  }

  /**
   * Send message to WebSocket server
   */
  private send(message: any) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[NetworkService] WebSocket not connected, cannot send message');
      return false;
    }

    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('[NetworkService] Error sending message:', error);
      return false;
    }
  }

  /**
   * Send data to TCP server
   */
  sendData(solverUUID: string, data: any) {
    const timestamp = new Date().toISOString();
    useNetwork.getState().set((draft) => {
      draft.transmissionInProgress = true;
      draft.errorMessage = null;
    });

    const success = this.send({
      type: 'SEND_DATA',
      payload: { solverUUID, data, timestamp }
    });

    if (!success) {
      useNetwork.getState().set((draft) => {
        draft.transmissionInProgress = false;
        draft.errorMessage = 'WebSocket not connected';
      });
    }

    // Note: Do NOT emit NETWORK_SEND_DATA here - this method is already called by that event handler
    // Emitting it again would cause an infinite loop
  }

  /**
   * Update TCP server configuration
   */
  updateConfig(tcpHost: string, tcpPort: number) {
    this.send({
      type: 'UPDATE_CONFIG',
      payload: { tcpHost, tcpPort }
    });

    // Note: Do NOT emit NETWORK_UPDATE_CONFIG here - this method is already called by that event handler
    // Emitting it again would cause an infinite loop
  }

  /**
   * Connect to TCP server
   */
  connectTCP() {
    this.send({ type: 'CONNECT' });
  }

  /**
   * Disconnect from TCP server
   */
  disconnectTCP() {
    this.send({ type: 'DISCONNECT' });
  }

  /**
   * Get current connection status
   */
  getStatus() {
    this.send({ type: 'GET_STATUS' });
  }
}

// Export singleton instance
export const networkService = new NetworkService();
