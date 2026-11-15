import { useEffect, useRef, useState } from 'react';
import './LiveChart.css';

const MAX_POINTS = 20;
const PREVIEW    = 5;

const getWsUrl = () => {
  const apiUrl = (import.meta.env.VITE_API_URL || 'https://depin-guard-backend-nsvs.onrender.com').trim().replace(/\/$/, '');
  return apiUrl.replace('https://', 'wss://').replace('http://', 'ws://') + '/ws/live';
};

export default function LiveChart({ onConnect, onData, initialData = [] }) {
  const [data, setData]           = useState([]);
  const [connected, setConnected] = useState(false);
  const [expanded, setExpanded]   = useState(false);
  const wsRef                     = useRef(null);

  useEffect(() => {
    if (data.length === 0 && initialData && initialData.length > 0) {
      const mapped = initialData.map(r => ({
        device_id: r.device,
        machine_name: r.machine_name || r.device,
        temperature: r.value ?? r.temp,
        vibration: r.vib,
        power_usage: r.pwr,
        pressure: r.pressure ?? 0,
        is_anomaly: r.status === 'critical' || r.status === 'warning'
      }));
      setData(mapped);
    }
  }, [initialData]);

  useEffect(() => {
    let ws;
    let retryTimeout;

    const connect = () => {
      const WS_URL = getWsUrl();
      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        setConnected(true);
        onConnect?.();
      };

      ws.onclose = () => {
        setConnected(false);
        retryTimeout = setTimeout(connect, 3000);
      };

      ws.onerror = () => setConnected(false);

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (!parsed || typeof parsed !== 'object') return;
          setData((prev) => [...prev.slice(-(MAX_POINTS - 1)), parsed]);
          onData?.(parsed);
        } catch {}
      };

      wsRef.current = ws;
    };

    connect();
    return () => { clearTimeout(retryTimeout); ws?.close(); };
  }, []);

  const reversed     = [...data].reverse();
  const visibleRows  = expanded ? reversed : reversed.slice(0, PREVIEW);
  const hiddenCount  = reversed.length - PREVIEW;

  return (
    <div className="live-chart-container">
      <div className="live-chart-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h3 className="live-chart-title">Live Sensor Stream (Continuous Ingestion)</h3>
          <span style={{ fontSize: '0.72rem', color: '#38bdf8', background: 'rgba(56,189,248,0.1)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(56,189,248,0.2)' }}>
            2s Telemetry Interval
          </span>
        </div>
        <span className={`connection-badge ${connected ? 'connected' : 'disconnected'}`}>
          <span className={`status-dot ${connected ? 'connected' : 'disconnected'}`} />
          {connected ? 'Live Connected' : 'Reconnecting...'}
        </span>
      </div>

      {data.length === 0 ? (
        <p className="live-chart-empty">
          {connected ? 'Streaming real industrial telemetry...' : 'Connecting to live data stream...'}
        </p>
      ) : (
        <>
          <div className="live-chart-table-wrapper">
            <table className="live-chart-table">
              <thead>
                <tr>
                  <th>Machine / Device</th>
                  <th>Temperature</th>
                  <th>Vibration</th>
                  <th>Power Usage</th>
                  <th>Pressure</th>
                  <th>AI Detection</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, i) => (
                  <tr key={i} className={row.is_anomaly ? 'anomaly-row' : 'normal-row'}>
                    <td style={{ fontWeight: 600 }}>
                      <span style={{ color: '#38bdf8', fontFamily: 'monospace' }}>{row.device_id ?? 'Device'}</span>
                      {row.machine_name && row.machine_name !== row.device_id && (
                        <span style={{ color: '#94a3b8', fontSize: '0.75rem', marginLeft: '6px' }}>
                          ({row.machine_name})
                        </span>
                      )}
                    </td>
                    <td>{row.temperature != null ? `${Number(row.temperature).toFixed(1)} °C` : '—'}</td>
                    <td>{row.vibration != null ? `${Number(row.vibration).toFixed(2)} mm/s` : '—'}</td>
                    <td>{row.power_usage != null ? `${Number(row.power_usage).toFixed(1)} W` : '—'}</td>
                    <td>{row.pressure != null && row.pressure > 0 ? `${Number(row.pressure).toFixed(1)} bar` : '—'}</td>
                    <td>
                      <span className={`status-cell ${row.is_anomaly ? 'anomaly' : 'normal'}`}>
                        {row.is_anomaly ? 'Critical Alert' : 'Normal'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {hiddenCount > 0 && (
            <button
              className="live-expand-btn"
              onClick={() => setExpanded(p => !p)}
            >
              {expanded
                ? '▲ Show Less'
                : `▼ Show ${hiddenCount} More Readings`}
            </button>
          )}
        </>
      )}
    </div>
  );
}