import create from 'zustand';
import produce from 'immer';

export type NetworkStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export type NetworkStore = {
  // WebSocket connection (Browser ↔ Backend)
  wsConnected: boolean;
  wsStatus: NetworkStatus;

  // TCP connection (Backend ↔ Target Server)
  tcpConnected: boolean;
  tcpStatus: NetworkStatus;
  tcpHost: string;
  tcpPort: number;

  // Transmission tracking
  transmissionInProgress: boolean;
  lastTransmissionTime: string | null;
  lastTransmissionStatus: 'success' | 'failed' | null;
  lastBytesTransmitted: number;
  errorMessage: string | null;

  // Settings
  autoConnect: boolean;

  // Connection metadata
  reconnectAttempts: number;
  queuedMessages: number;

  set: (fn: (draft: NetworkStore) => void) => void;
};

export const useNetwork = create<NetworkStore>((set, get) => ({
  // WebSocket state
  wsConnected: false,
  wsStatus: 'disconnected',

  // TCP state
  tcpConnected: false,
  tcpStatus: 'disconnected',
  tcpHost: '127.0.0.1',
  tcpPort: 5000,

  // Transmission state
  transmissionInProgress: false,
  lastTransmissionTime: null,
  lastTransmissionStatus: null,
  lastBytesTransmitted: 0,
  errorMessage: null,

  // Settings
  autoConnect: false,

  // Connection metadata
  reconnectAttempts: 0,
  queuedMessages: 0,

  set: (fn) => set(produce(fn))
}));
