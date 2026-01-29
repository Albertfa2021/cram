import React, { useState, useEffect } from 'react';
import { useNetwork } from '../../../network/network-store';
import { on } from '../../../messenger';
import shallow from 'zustand/shallow';

interface TransmissionStatusProps {
  uuid: string;
  onSendToNetwork: () => void;
}

export const TransmissionStatus: React.FC<TransmissionStatusProps> = ({ uuid, onSendToNetwork }) => {
  const [updateTrigger, setUpdateTrigger] = useState(0);

  const {
    tcpConnected,
    transmissionInProgress,
    lastTransmissionTime,
    lastTransmissionStatus,
    lastBytesTransmitted
  } = useNetwork(
    (state) => ({
      tcpConnected: state.tcpConnected,
      transmissionInProgress: state.transmissionInProgress,
      lastTransmissionTime: state.lastTransmissionTime,
      lastTransmissionStatus: state.lastTransmissionStatus,
      lastBytesTransmitted: state.lastBytesTransmitted
    }),
    shallow
  );

  // Listen to transmission complete event
  useEffect(() => {
    const handler = () => {
      setUpdateTrigger((prev) => prev + 1);
    };
    on('NETWORK_TRANSMISSION_COMPLETE', handler);
  }, []);

  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleString();
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} bytes`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getStatusBadge = () => {
    if (transmissionInProgress) {
      return (
        <span style={{
          padding: '4px 8px',
          backgroundColor: '#2196F3',
          color: 'white',
          borderRadius: '4px',
          fontSize: '0.9em'
        }}>
          Transmitting...
        </span>
      );
    }

    if (lastTransmissionStatus === 'success') {
      return (
        <span style={{
          padding: '4px 8px',
          backgroundColor: '#4CAF50',
          color: 'white',
          borderRadius: '4px',
          fontSize: '0.9em'
        }}>
          ✓ Success
        </span>
      );
    }

    if (lastTransmissionStatus === 'failed') {
      return (
        <span style={{
          padding: '4px 8px',
          backgroundColor: '#f44336',
          color: 'white',
          borderRadius: '4px',
          fontSize: '0.9em'
        }}>
          ✗ Failed
        </span>
      );
    }

    return null;
  };

  return (
    <div style={{ marginTop: '16px', padding: '12px', border: '1px solid #ccc', borderRadius: '4px' }}>
      <h3 style={{ margin: '0 0 12px 0' }}>Network Transmission</h3>

      {/* Last Transmission Info */}
      {lastTransmissionTime && (
        <div style={{ marginBottom: '12px', fontSize: '0.9em' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
            <strong style={{ marginRight: '8px' }}>Last Transmission:</strong>
            {getStatusBadge()}
          </div>
          <div style={{ color: '#666' }}>
            Time: {formatTimestamp(lastTransmissionTime)}
          </div>
          {lastTransmissionStatus === 'success' && (
            <div style={{ color: '#666' }}>
              Size: {formatBytes(lastBytesTransmitted)}
            </div>
          )}
        </div>
      )}

      {/* Send Button */}
      <button
        onClick={onSendToNetwork}
        disabled={!tcpConnected || transmissionInProgress}
        style={{
          padding: '10px 16px',
          backgroundColor: '#FF9800',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: (tcpConnected && !transmissionInProgress) ? 'pointer' : 'not-allowed',
          opacity: (tcpConnected && !transmissionInProgress) ? 1 : 0.5,
          width: '100%',
          fontSize: '1em',
          fontWeight: 'bold'
        }}
      >
        {transmissionInProgress ? 'Sending...' : 'Send to Network'}
      </button>

      {/* Helper Text */}
      {!tcpConnected && (
        <div style={{
          marginTop: '8px',
          padding: '8px',
          backgroundColor: '#fff3e0',
          border: '1px solid #ffe0b2',
          borderRadius: '4px',
          fontSize: '0.85em',
          color: '#e65100'
        }}>
          Connect to TCP server to enable network transmission
        </div>
      )}
    </div>
  );
};
