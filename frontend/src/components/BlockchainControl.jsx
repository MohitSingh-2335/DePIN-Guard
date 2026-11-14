import React, { useState, useEffect } from 'react';

export const BlockchainControl = ({ apiUrl, apiKey }) => {
  const [status, setStatus] = useState('unknown');
  const [loading, setLoading] = useState(false);
  const [containers, setContainers] = useState([]);
  const [message, setMessage] = useState('');

  const checkStatus = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/blockchain/status`, {
        headers: { 'X-API-Key': apiKey }
      });
      const data = await response.json();
      if (response.ok && data) {
        setStatus(data.status || 'unknown');
        setContainers(data.containers || []);
        setMessage(data.message || '');
      } else {
        setStatus('error');
        setMessage(data.detail || 'Connection failed');
      }
    } catch (error) {
      setStatus('error');
      setMessage(error.message || 'Connection failed');
    }
  };

  const handleStart = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/api/blockchain/start`, {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (response.ok && data) {
        setStatus(data.status || 'unknown');
        setContainers(data.containers || []);
        setMessage(data.message || 'Blockchain started');
      } else {
        setStatus('error');
        setMessage(data.detail || 'Failed to start blockchain');
      }
    } catch (error) {
      setStatus('error');
      setMessage('Failed to start blockchain');
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/api/blockchain/stop`, {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (response.ok && data) {
        setStatus(data.status || 'unknown');
        setContainers(data.containers || []);
        setMessage(data.message || 'Blockchain stopped');
      } else {
        setStatus('error');
        setMessage(data.detail || 'Failed to stop blockchain');
      }
    } catch (error) {
      setStatus('error');
      setMessage('Failed to stop blockchain');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const statusColors = {
    running: '#10b981',
    stopped: '#ef4444',
    partial: '#f59e0b',
    error: '#dc2626',
    unknown: '#6b7280'
  };

  return (
    <div style={{
      padding: '20px',
      border: `2px solid ${statusColors[status] || '#ccc'}`,
      borderRadius: '8px',
      backgroundColor: '#f9fafb',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <h2 style={{ margin: '0 0 15px 0', color: '#111827' }}>Blockchain Control</h2>

      <div style={{
        display: 'inline-block',
        padding: '6px 12px',
        backgroundColor: statusColors[status] || '#ccc',
        color: 'white',
        borderRadius: '4px',
        fontSize: '14px',
        fontWeight: 'bold',
        marginBottom: '15px'
      }}>
        {status.toUpperCase()}
      </div>

      {message && (
        <p style={{
          margin: '10px 0 15px 0',
          color: '#374151',
          fontSize: '14px',
          fontStyle: 'italic'
        }}>
          {message}
        </p>
      )}

      <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
        <button
          onClick={handleStart}
          disabled={loading || status === 'running'}
          style={{
            padding: '8px 16px',
            backgroundColor: status === 'running' ? '#d1d5db' : '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: status === 'running' ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
            fontSize: '14px'
          }}
        >
          {loading ? 'Starting...' : 'Start'}
        </button>

        <button
          onClick={handleStop}
          disabled={loading || status === 'stopped'}
          style={{
            padding: '8px 16px',
            backgroundColor: status === 'stopped' ? '#d1d5db' : '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: status === 'stopped' ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
            fontSize: '14px'
          }}
        >
          {loading ? 'Stopping...' : 'Stop'}
        </button>

        <button
          onClick={checkStatus}
          disabled={loading}
          style={{
            padding: '8px 16px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '14px'
          }}
        >
          {loading ? 'Updating...' : 'Refresh'}
        </button>
      </div>

      {containers.length > 0 && (
        <div>
          <h4 style={{ margin: '15px 0 10px 0', color: '#374151', fontSize: '14px' }}>
            Running Containers:
          </h4>
          <ul style={{ margin: '0', paddingLeft: '20px', fontSize: '13px', color: '#555' }}>
            {containers.map(container => (
              <li key={container}>{container}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default BlockchainControl;
