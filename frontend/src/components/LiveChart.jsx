import { useEffect, useRef, useState } from 'react';
import './LiveChart.css';

const MAX_POINTS = 20;
const PREVIEW    = 5;

const getWsUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL;
  if (!apiUrl) {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/ws/live`;
  }
  return apiUrl.replace('https://', 'wss://').replace('http://', 'ws://') + '/ws/live';
};

export default function LiveChart({ onConnect, initialData = [] }) {
  const [data, setData]           = useState([]);
  const [connected, setConnected] = useState(false);
  const [expanded, setExpanded]   = useState(false);
  const wsRef                     = useRef(null);

  useEffect(() => {
    if (data.length === 0 && initialData && initialData.length > 0) {
      const mapped = initialData.map(r => ({
        device_id: r.device,
        temperature: r.value ?? r.temp,
        vibration: r.vib,
        power_usage: r.pwr,
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
        <h3 className="live-chart-title">Live Sensor Updates</h3>
        <span className={`connection-badge ${connected ? 'connected' : 'disconnected'}`}>
          <span className={`status-dot ${connected ? 'connected' : 'disconnected'}`} />
          {connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      {data.length === 0 ? (
        <p className="live-chart-empty">
          {connected ? 'Waiting for sensor data...' : 'Connecting to live data stream...'}
        </p>
      ) : (
        <>
          <div className="live-chart-table-wrapper">
            <table className="live-chart-table">
              <thead>
                <tr>
                  <th>Device</th>
                  <th>Temp °C</th>
                  <th>Vibration</th>
                  <th>Power W</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, i) => (
                  <tr key={i} className={row.is_anomaly ? 'anomaly-row' : 'normal-row'}>
                    <td>{row.device_id   ?? 'N/A'}</td>
                    <td>{row.temperature ?? 'N/A'}</td>
                    <td>{row.vibration   ?? 'N/A'}</td>
                    <td>{row.power_usage ?? 'N/A'}</td>
                    <td>
                      <span className={`status-cell ${row.is_anomaly ? 'anomaly' : 'normal'}`}>
                        {row.is_anomaly ? 'Anomaly' : 'Normal'}
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