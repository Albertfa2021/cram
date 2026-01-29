import React, { useState, useEffect } from 'react';
import { useNetwork } from '../../../network/network-store';
import { networkService } from '../../../network/network-service';
import shallow from 'zustand/shallow';

export const NetworkConfig: React.FC = () => {
  const {
    wsConnected,
    wsStatus,
    tcpConnected,
    tcpStatus,
    tcpHost,
    tcpPort,
    reconnectAttempts,
    queuedMessages,
    errorMessage
  } = useNetwork(
    (state) => ({
      wsConnected: state.wsConnected,
      wsStatus: state.wsStatus,
      tcpConnected: state.tcpConnected,
      tcpStatus: state.tcpStatus,
      tcpHost: state.tcpHost,
      tcpPort: state.tcpPort,
      reconnectAttempts: state.reconnectAttempts,
      queuedMessages: state.queuedMessages,
      errorMessage: state.errorMessage
    }),
    shallow
  );

  const [inputHost, setInputHost] = useState(tcpHost);
  const [inputPort, setInputPort] = useState(tcpPort.toString());
  const [configChanged, setConfigChanged] = useState(false);

  // Initialize network service on mount
  useEffect(() => {
    networkService.connect();
    return () => {
      networkService.disconnect();
    };
  }, []);

  // Track config changes
  useEffect(() => {
    const changed = inputHost !== tcpHost || parseInt(inputPort, 10) !== tcpPort;
    setConfigChanged(changed);
  }, [inputHost, inputPort, tcpHost, tcpPort]);

  const handleApplyConfig = () => {
    const port = parseInt(inputPort, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      alert('Port must be between 1 and 65535');
      return;
    }

    networkService.updateConfig(inputHost, port);
    setConfigChanged(false);
  };

  const handleConnectTCP = () => {
    if (tcpConnected) {
      networkService.disconnectTCP();
    } else {
      networkService.connectTCP();
    }
  };

  const getStatusIcon = (connected: boolean, status: string) => {
    if (status === 'connecting') return '🟡';
    if (status === 'error') return '🔴';
    return connected ? '🟢' : '⚫';
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting...';
      case 'disconnected': return 'Disconnected';
      case 'error': return 'Error';
      default: return 'Unknown';
    }
  };

  return (
    <div style={{ marginTop: '16px', padding: '12px', border: '1px solid #ccc', borderRadius: '4px' }}>
      <h3 style={{ margin: '0 0 12px 0' }}>Network Configuration</h3>

      {/* Connection Status */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
          <span style={{ marginRight: '8px' }}>{getStatusIcon(wsConnected, wsStatus)}</span>
          <strong>Backend Server:</strong>
          <span style={{ marginLeft: '8px' }}>{getStatusText(wsStatus)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ marginRight: '8px' }}>{getStatusIcon(tcpConnected, tcpStatus)}</span>
          <strong>TCP Server:</strong>
          <span style={{ marginLeft: '8px' }}>{getStatusText(tcpStatus)}</span>
          {reconnectAttempts > 0 && (
            <span style={{ marginLeft: '8px', fontSize: '0.9em', color: '#666' }}>
              (Attempt {reconnectAttempts})
            </span>
          )}
        </div>
        {queuedMessages > 0 && (
          <div style={{ marginTop: '4px', fontSize: '0.9em', color: '#666' }}>
            Queued messages: {queuedMessages}
          </div>
        )}
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div style={{
          marginBottom: '12px',
          padding: '8px',
          backgroundColor: '#fee',
          border: '1px solid #fcc',
          borderRadius: '4px',
          fontSize: '0.9em',
          color: '#c00'
        }}>
          {errorMessage}
        </div>
      )}

      {/* TCP Configuration */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ marginBottom: '8px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
            Target Server IP:
          </label>
          <input
            type="text"
            value={inputHost}
            onChange={(e) => setInputHost(e.target.value)}
            placeholder="192.168.1.100"
            disabled={!wsConnected}
            style={{
              width: '100%',
              padding: '6px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontFamily: 'monospace'
            }}
          />
        </div>
        <div style={{ marginBottom: '8px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
            Target Server Port:
          </label>
          <input
            type="number"
            value={inputPort}
            onChange={(e) => setInputPort(e.target.value)}
            placeholder="5000"
            min="1"
            max="65535"
            disabled={!wsConnected}
            style={{
              width: '100%',
              padding: '6px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontFamily: 'monospace'
            }}
          />
        </div>
        {configChanged && (
          <button
            onClick={handleApplyConfig}
            disabled={!wsConnected}
            style={{
              padding: '6px 12px',
              marginBottom: '8px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: wsConnected ? 'pointer' : 'not-allowed',
              opacity: wsConnected ? 1 : 0.5
            }}
          >
            Apply Configuration
          </button>
        )}
      </div>

      {/* Connection Controls */}
      <div>
        <button
          onClick={handleConnectTCP}
          disabled={!wsConnected || tcpStatus === 'connecting'}
          style={{
            padding: '8px 16px',
            backgroundColor: tcpConnected ? '#f44336' : '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: (wsConnected && tcpStatus !== 'connecting') ? 'pointer' : 'not-allowed',
            opacity: (wsConnected && tcpStatus !== 'connecting') ? 1 : 0.5,
            width: '100%'
          }}
        >
          {tcpStatus === 'connecting' ? 'Connecting...' : (tcpConnected ? 'Disconnect from Server' : 'Connect to Server')}
        </button>
      </div>

      {/* Connection Info */}
      {tcpConnected && (
        <div style={{
          marginTop: '12px',
          padding: '8px',
          backgroundColor: '#e8f5e9',
          border: '1px solid #c8e6c9',
          borderRadius: '4px',
          fontSize: '0.9em'
        }}>
          Connected to: <code>{tcpHost}:{tcpPort}</code>
        </div>
      )}
    </div>
  );
};
