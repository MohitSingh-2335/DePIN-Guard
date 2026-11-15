import { useEffect, useRef, useState, useCallback } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import { authenticatedFetch } from '../utils/api';
import './LiveChart.css';

const MAX_POINTS = 20;
const PREVIEW_COUNT = 5;

const getWsUrl = () => {
  const apiUrl = (import.meta.env.VITE_API_URL || 'https://depin-guard-backend-nsvs.onrender.com').trim().replace(/\/$/, '');
  return apiUrl.replace('https://', 'wss://').replace('http://', 'ws://') + '/ws/live';
};

const CustomStreamTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0]?.payload;
  if (!item) return null;

  return (
    <div className="stream-tooltip">
      <div className="tooltip-header">
        <span className="tooltip-node">{item.device_id || 'Industrial Node'}</span>
        <span className={`tooltip-status ${item.is_anomaly ? 'anomaly' : 'normal'}`}>
          {item.is_anomaly ? 'CRITICAL ALERT' : 'NOMINAL'}
        </span>
      </div>
      <div className="tooltip-body">
        <div><strong>Machine:</strong> {item.machine_name || item.device_id}</div>
        <div><strong>Temperature:</strong> {Number(item.temperature || 0).toFixed(1)} °C</div>
        <div><strong>Vibration:</strong> {Number(item.vibration || 0).toFixed(2)} mm/s</div>
        <div><strong>Power Usage:</strong> {Number(item.power_usage || 0).toFixed(1)} W</div>
        <div><strong>Timestamp:</strong> {item.time_label || 'Live'}</div>
      </div>
    </div>
  );
};

export default function LiveChart({ onConnect, onData, initialData = [] }) {
  const [data, setData] = useState([]);
  const [streamMode, setStreamMode] = useState('connecting'); // 'ws' | 'http' | 'connecting'
  const [expanded, setExpanded] = useState(false);
  const [chartMetric, setChartMetric] = useState('temp'); // 'temp' | 'vib' | 'dual'
  const [packetCount, setPacketCount] = useState(0);

  const wsRef = useRef(null);
  const lastPacketTimeRef = useRef(0);
  const retryTimeoutRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const isComponentMounted = useRef(true);

  // Ingestion handler: updates internal state and notifies parent
  const ingestTelemetry = useCallback((rawItem) => {
    if (!rawItem || typeof rawItem !== 'object') return;
    lastPacketTimeRef.current = Date.now();

    const timestamp = rawItem.timestamp ? new Date(rawItem.timestamp) : new Date();
    const timeLabel = !isNaN(timestamp.getTime())
      ? timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const normalized = {
      device_id: rawItem.device_id || rawItem.device || 'Node-Edge',
      machine_name: rawItem.machine_name || rawItem.device_id || rawItem.device || 'Industrial Machine',
      temperature: Number(rawItem.temperature ?? rawItem.temp ?? rawItem.value ?? 22.0),
      vibration: Number(rawItem.vibration ?? rawItem.vib ?? 0.25),
      power_usage: Number(rawItem.power_usage ?? rawItem.pwr ?? 12.0),
      pressure: Number(rawItem.pressure ?? 0),
      is_anomaly: Boolean(rawItem.is_anomaly || rawItem.status === 'critical' || rawItem.anomaly === 1),
      status: rawItem.status || (rawItem.is_anomaly ? 'critical' : 'normal'),
      time_label: timeLabel,
      total_scans: rawItem.total_scans,
      anomalies: rawItem.anomalies,
    };

    setData((prev) => {
      // Avoid duplicate consecutive timestamps for the same device
      const last = prev[prev.length - 1];
      if (last && last.device_id === normalized.device_id && last.time_label === normalized.time_label) {
        return prev;
      }
      return [...prev.slice(-(MAX_POINTS - 1)), normalized];
    });

    setPacketCount((c) => c + 1);
    onData?.(normalized);
  }, [onData]);

  // Seed with initial data if available
  useEffect(() => {
    if (data.length === 0 && initialData && initialData.length > 0) {
      const seeded = initialData.slice(0, MAX_POINTS).map((r, i) => {
        const ts = r.timestamp ? new Date(r.timestamp) : new Date();
        return {
          device_id: r.device || `Node-${i + 1}`,
          machine_name: r.machine_name || r.device || 'Machine',
          temperature: Number(r.value ?? r.temp ?? 22.0),
          vibration: Number(r.vib ?? 0.25),
          power_usage: Number(r.pwr ?? 12.0),
          pressure: Number(r.pressure ?? 0),
          is_anomaly: r.status === 'critical' || r.anomaly === 1,
          status: r.status || 'normal',
          time_label: !isNaN(ts.getTime())
            ? ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            : `${i + 1}s ago`,
        };
      });
      setData(seeded);
    }
  }, [initialData]);

  // Primary: WebSocket Engine
  useEffect(() => {
    isComponentMounted.current = true;

    const connectWs = () => {
      try {
        const url = getWsUrl();
        const ws = new WebSocket(url);

        ws.onopen = () => {
          if (!isComponentMounted.current) return;
          setStreamMode('ws');
          onConnect?.();
        };

        ws.onmessage = (event) => {
          if (!isComponentMounted.current) return;
          try {
            const parsed = JSON.parse(event.data);
            if (parsed && typeof parsed === 'object') {
              setStreamMode('ws');
              ingestTelemetry(parsed);
            }
          } catch {
            // Non-JSON or malformed frame
          }
        };

        ws.onerror = () => {
          if (!isComponentMounted.current) return;
          // Fall back gracefully to HTTP stream
        };

        ws.onclose = () => {
          if (!isComponentMounted.current) return;
          retryTimeoutRef.current = setTimeout(connectWs, 4000);
        };

        wsRef.current = ws;
      } catch {
        // Fall back gracefully
      }
    };

    connectWs();

    // Resilient Fallback: If no packets received via WebSocket for 3.5 seconds, poll HTTP
    pollIntervalRef.current = setInterval(async () => {
      const now = Date.now();
      const timeSinceLast = now - lastPacketTimeRef.current;

      // If WS hasn't fired in > 3.5 seconds, actively poll recent telemetry
      if (timeSinceLast > 3500) {
        try {
          const res = await authenticatedFetch('/api/history?limit=3');
          if (res && res.ok) {
            const json = await res.json();
            const list = json.history || [];
            if (list.length > 0) {
              setStreamMode('http');
              // Feed the most recent record
              ingestTelemetry(list[0]);
              onConnect?.();
            }
          }
        } catch {
          // Keep retrying seamlessly
        }
      }
    }, 2500);

    return () => {
      isComponentMounted.current = false;
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [ingestTelemetry, onConnect]);

  const reversed = [...data].reverse();
  const visibleRows = expanded ? reversed : reversed.slice(0, PREVIEW_COUNT);
  const hiddenCount = reversed.length - PREVIEW_COUNT;

  const currentMeanTemp = data.length > 0
    ? (data.reduce((acc, d) => acc + (d.temperature || 0), 0) / data.length).toFixed(1)
    : '22.0';

  const currentPeakVib = data.length > 0
    ? Math.max(...data.map((d) => d.vibration || 0)).toFixed(2)
    : '0.25';

  return (
    <div className="live-scada-container">
      {/* ── High-Tech Header ── */}
      <div className="scada-header">
        <div className="scada-title-group">
          <div className="scada-title">
            <span className="scada-accent-bar" />
            <h3>Real-Time Industrial Sensor Telemetry Stream</h3>
          </div>
          <p className="scada-subtitle">
            Autonomous multi-sensor ingestion, temporal LSTM autoencoder scoring, and SHA-256 consortium audit trail
          </p>
        </div>

        <div className="scada-controls">
          <div className="stream-badge-wrapper">
            <span className={`scada-live-pill ${streamMode}`}>
              <span className="live-radar-dot" />
              {streamMode === 'ws'
                ? 'WebSocket Live (2.0s)'
                : streamMode === 'http'
                ? 'HTTP Auto-Stream (2.5s)'
                : 'Connecting Pipeline...'}
            </span>
          </div>

          <div className="chart-metric-selector">
            <button
              className={`metric-tab ${chartMetric === 'temp' ? 'active' : ''}`}
              onClick={() => setChartMetric('temp')}
            >
              Thermal (°C)
            </button>
            <button
              className={`metric-tab ${chartMetric === 'vib' ? 'active' : ''}`}
              onClick={() => setChartMetric('vib')}
            >
              Vibration (mm/s)
            </button>
            <button
              className={`metric-tab ${chartMetric === 'dual' ? 'active' : ''}`}
              onClick={() => setChartMetric('dual')}
            >
              Dual Channel
            </button>
          </div>
        </div>
      </div>

      {/* ── Key Telemetry Quick Ticker ── */}
      <div className="scada-metrics-strip">
        <div className="strip-item">
          <span className="strip-label">Mean Fleet Temp</span>
          <span className="strip-value cyan">{currentMeanTemp} °C</span>
          <span className="strip-note">Nominal 15–35°C</span>
        </div>
        <div className="strip-item">
          <span className="strip-label">Peak Vibration</span>
          <span className="strip-value amber">{currentPeakVib} mm/s</span>
          <span className="strip-note">Tolerance &lt; 8.0</span>
        </div>
        <div className="strip-item">
          <span className="strip-label">Sampling Pulse</span>
          <span className="strip-value emerald">0.50 Hz</span>
          <span className="strip-note">Continuous 24/7</span>
        </div>
        <div className="strip-item">
          <span className="strip-label">Live Ingested Packets</span>
          <span className="strip-value purple">{packetCount > 0 ? packetCount : data.length}</span>
          <span className="strip-note">Edge Verified</span>
        </div>
      </div>

      {/* ── Oscilloscope Waveform Area Chart ── */}
      <div className="scada-chart-card">
        <div className="chart-card-top">
          <span className="chart-card-label">
            Multi-Sensor Rolling Temporal Waveform (Last {data.length} Transmissions)
          </span>
          <div className="chart-legend-row">
            {(chartMetric === 'temp' || chartMetric === 'dual') && (
              <span className="legend-item"><span className="legend-color cyan" /> Temperature (°C)</span>
            )}
            {(chartMetric === 'vib' || chartMetric === 'dual') && (
              <span className="legend-item"><span className="legend-color amber" /> Vibration (mm/s)</span>
            )}
            <span className="legend-item"><span className="legend-color red" /> Nominal Threshold Limit</span>
          </div>
        </div>

        <div className="waveform-chart-wrapper">
          {data.length === 0 ? (
            <div className="chart-loading-placeholder">
              <div className="loading-spinner" />
              <span>Synchronizing sensor edge telemetry...</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data} margin={{ top: 12, right: 18, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="vibGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis
                  dataKey="time_label"
                  stroke="rgba(148,163,184,0.6)"
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                />
                <YAxis
                  stroke="rgba(148,163,184,0.6)"
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                  domain={['dataMin - 2', 'dataMax + 5']}
                />
                <Tooltip content={<CustomStreamTooltip />} />
                <ReferenceLine y={35} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.7} />

                {(chartMetric === 'temp' || chartMetric === 'dual') && (
                  <Area
                    type="monotone"
                    dataKey="temperature"
                    stroke="#38bdf8"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#tempGradient)"
                    isAnimationActive={false}
                  />
                )}
                {(chartMetric === 'vib' || chartMetric === 'dual') && (
                  <Line
                    type="monotone"
                    dataKey="vibration"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── SCADA Live Packet Feed Table ── */}
      <div className="scada-table-card">
        <div className="table-card-top">
          <span className="table-card-title">Edge Telemetry Packet Feed</span>
          <span className="table-card-count">{data.length} active edge frames</span>
        </div>

        {data.length === 0 ? (
          <p className="scada-empty-text">Awaiting next telemetry cycle...</p>
        ) : (
          <>
            <div className="scada-table-wrapper">
              <table className="scada-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Node ID</th>
                    <th>Equipment Type</th>
                    <th>Thermal (°C)</th>
                    <th>Vibration (mm/s)</th>
                    <th>Power (W)</th>
                    <th>Pressure</th>
                    <th>AI Evaluation</th>
                    <th>Provenance</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row, idx) => {
                    const isAlert = row.is_anomaly || row.status === 'critical';
                    return (
                      <tr key={idx} className={isAlert ? 'scada-row-alert' : 'scada-row-nominal'}>
                        <td className="time-cell">{row.time_label}</td>
                        <td className="node-cell">
                          <span className="node-id-badge">{row.device_id}</span>
                        </td>
                        <td className="machine-cell">{row.machine_name}</td>
                        <td className={`numeric-cell ${row.temperature > 85 ? 'val-critical' : row.temperature > 35 ? 'val-warning' : 'val-normal'}`}>
                          {row.temperature != null ? `${Number(row.temperature).toFixed(1)} °C` : '—'}
                        </td>
                        <td className={`numeric-cell ${row.vibration > 8 ? 'val-critical' : 'val-normal'}`}>
                          {row.vibration != null ? `${Number(row.vibration).toFixed(2)} mm/s` : '—'}
                        </td>
                        <td className="numeric-cell">
                          {row.power_usage != null ? `${Number(row.power_usage).toFixed(1)} W` : '—'}
                        </td>
                        <td className="numeric-cell">
                          {row.pressure != null && row.pressure > 0 ? `${Number(row.pressure).toFixed(1)} bar` : '—'}
                        </td>
                        <td>
                          <span className={`ai-badge ${isAlert ? 'critical' : 'optimal'}`}>
                            {isAlert ? 'Critical Alert' : 'Optimal'}
                          </span>
                        </td>
                        <td className="provenance-cell">
                          <span className="sha-pill" title="Cryptographically committed to Hyperledger Fabric">
                            SHA-256 Armed
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {hiddenCount > 0 && (
              <button
                className="scada-expand-btn"
                onClick={() => setExpanded((p) => !p)}
              >
                {expanded ? '▲ Collapse Feed' : `▼ View ${hiddenCount} More Live Edge Records`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
