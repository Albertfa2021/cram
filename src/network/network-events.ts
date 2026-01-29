import { on } from '../messenger';
import { networkService } from './network-service';

// Network event type definitions
declare global {
  interface EventTypes {
    // Connection management
    NETWORK_CONNECT: undefined;
    NETWORK_DISCONNECT: undefined;
    NETWORK_STATUS_UPDATE: {
      wsConnected: boolean;
      tcpConnected: boolean;
      tcpHost: string;
      tcpPort: number;
    };

    // Data transmission
    NETWORK_SEND_DATA: {
      solverUUID: string;
      data: any;
      timestamp: string;
    };
    NETWORK_TRANSMISSION_COMPLETE: {
      success: boolean;
      bytesTransmitted: number;
      timestamp: string;
      error?: string;
    };

    // Configuration
    NETWORK_UPDATE_CONFIG: {
      tcpHost: string;
      tcpPort: number;
    };
  }
}

// Register event handlers
on('NETWORK_SEND_DATA', (event) => {
  networkService.sendData(event.solverUUID, event.data);
});

on('NETWORK_CONNECT', () => {
  networkService.connect();
});

on('NETWORK_DISCONNECT', () => {
  networkService.disconnect();
});

on('NETWORK_UPDATE_CONFIG', (event) => {
  networkService.updateConfig(event.tcpHost, event.tcpPort);
});

export {};
