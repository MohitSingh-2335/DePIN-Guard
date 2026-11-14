import { useState, useEffect, useRef } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine, Legend
} from 'recharts';
import LiveChart from '../components/LiveChart';
import Layout from '../components/layout/Layout';
import IoTAlertCard from '../components/IoTAlertCard';
import { authenticatedFetch } from '../utils/api';
import './DashboardPage.css';

const CustomTooltip = ({ active, payload, label, timePeriod }) => {
  if (!active || !payload || !payload.length) return null;
  const scans  = payload.find(p => p.dataKey === 'raw');
  const alerts = payload.find(p => p.dataKey === 'alerts');
  return (
    <div style={{
      background: '#1e293b', border: '1px solid rgba(14,165,233,0.3)',
      borderRadius: 8, padding: '10px 14px', fontSize: 12,
      color: '#f1f5f9', boxShadow: '0 4px 20px rgba(0,0,0,0.4)', minWidth: 140,
    }}>
      <p style={{ margin: '0 0 8px', color: '#94a3b8', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 6 }}>
        {label}
      </p>
      {scans && (
        <p style={{ margin: '0 0 4px', color: '#6366f1', fontWeight: 600 }}>
          Scans: <span style={{ color: '#f1f5f9' }}>{scans.value}</span>
        </p>
      )}
      {alerts && (
        <p style={{ margin: 0, color: '#ef4444', fontWeight: 600 }}>
          Alerts: <span style={{ color: '#f1f5f9' }}>{alerts.value}</span>
        </p>
      )}
      {scans?.payload?.isPeak && (
        <p style={{ margin: '6px 0 0', fontSize: 11, color: '#a78bfa', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 5 }}>
          Peak activity
        </p>
      )}
    </div>
  );
};

const DashboardPage = () => {
  const [streamConnected, setStreamConnected] = useState(false);
  const [loading, setLoading]                 = useState(true);
  const [refreshing, setRefreshing]           = useState(false);
  const [stats, setStats]                     = useState({ activeDevices: null, totalData: null, alerts: null, uptime: null });
  const [recentData, setRecentData]           = useState([]);
  const [timePeriod, setTimePeriod]           = useState('24h');
  const [chartData, setChartData]             = useState([]);
  const [showAllSensors, setShowAllSensors]   = useState(false);
  const SENSOR_PREVIEW = 5;
  const sensorRef = useRef(null);

  const fetchDashboardData = async () => {
    try {
      const response = await authenticatedFetch('/api/dashboard');
      if (response && response.ok) {
        const json = await response.json();
        setStats({
          activeDevices: json.stats?.active_devices    ?? 0,
          totalData:     json.stats?.total_scans     ?? 0,
          alerts:        json.stats?.anomalies ?? 0,
          uptime:        json.stats?.uptime    ?? null,
        });
        const history = json.recent_data ?? [];
        setRecentData(history.length > 0
          ? history.map((rec, i) => ({
              id:     rec.id ?? i,
              device: rec.device ?? 'Unknown',
              value:  rec.temp ?? 0,
              vib:    rec.vib ?? 0,
              pwr:    rec.pwr ?? 0,
              unit:   '°C',
              status: rec.status ?? 'normal',
              time:   rec.timestamp ? new Date(rec.timestamp).toLocaleTimeString() : '—',
            }))
          : []
        );
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const fetchChartData = async (period) => {
    try {
      const response = await authenticatedFetch('/api/history/all');
      if (response && response.ok) {
        const json    = await response.json();
        const history = json.history ?? [];
        if (history.length === 0) return;

        // Bucket the actual records chronologically into 10 consistent segments
        const count = Math.min(history.length, 120);
        const sample = history.slice(0, count).reverse();
        const bucketSize = Math.max(1, Math.floor(sample.length / 10));

        const buckets = [];
        for (let i = 0; i < sample.length; i += bucketSize) {
          const slice = sample.slice(i, i + bucketSize);
          const alertCount = slice.filter(r => r.anomaly === 1 || r.status === 'critical').length;
          const firstTime = slice[0]?.timestamp;
          const timeLabel = firstTime && !isNaN(new Date(firstTime).getTime())
            ? new Date(firstTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : `Slot ${buckets.length + 1}`;

          buckets.push({
            label: timeLabel,
            raw: slice.length,
            alerts: alertCount,
          });
          if (buckets.length >= 10) break;
        }

        const maxRaw = Math.max(...buckets.map(b => b.raw), 1);
        const avg    = buckets.reduce((s, b) => s + b.raw, 0) / buckets.length;
        setChartData(buckets.map(b => ({
          label:  b.label,
          raw:    b.raw,
          alerts: b.alerts,
          isPeak: b.raw === maxRaw && b.raw > 0,
          isHigh: b.raw > avg * 1.5,
        })));
      }
    } catch {
      // Retain existing chartData on transient error
    }
  };

  useEffect(() => {
    fetchDashboardData();
    fetchChartData(timePeriod);
    const dashInterval  = setInterval(fetchDashboardData, 5000);
    const chartInterval = setInterval(() => fetchChartData(timePeriod), 10000);
    return () => { clearInterval(dashInterval); clearInterval(chartInterval); };
  }, [timePeriod]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchDashboardData(), fetchChartData(timePeriod)]);
    setRefreshing(false);
  };

  const renderStatValue = (value, formatter = (v) => v) => {
    if (loading || refreshing) return '...';
    if (value === null || value === undefined) return 'N/A';
    return formatter(value);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'normal':   return '#22c55e';
      case 'warning':  return '#f59e0b';
      case 'critical': return '#ef4444';
      default:         return '#6b7280';
    }
  };

  const getBarColor = (entry) => {
    if (entry.isPeak) return '#a78bfa';
    if (entry.isHigh) return '#38bdf8';
    return '#6366f1';
  };

  const getActivityLabel = (period) => {
    if (period === '24h') return 'Sensor scans & alerts per 2-hour block';
    if (period === '7d')  return 'Total scans & alerts per day';
    return 'Scans & alerts per day (last 30 days)';
  };

  const totalScans  = chartData.reduce((s, d) => s + d.raw, 0);
  const totalAlerts = chartData.reduce((s, d) => s + d.alerts, 0);
  const peakLabel   = chartData.length ? chartData.reduce((a, b) => (b.raw > a.raw ? b : a), chartData[0]).label : '—';
  const avgScans    = chartData.length ? Math.round(totalScans / chartData.length) : 0;

  const visibleSensors = showAllSensors ? recentData : recentData.slice(0, SENSOR_PREVIEW);

  return (
    <Layout>
      <div className="dashboard-container">

        {/* ── Header ── */}
        <div className="page-header">
          <div>
            <h1 className="page-title">IoT Dashboard</h1>
            <p className="page-subtitle">System Health &amp; Live Monitoring</p>
          </div>
        </div>

        {/* ── Stats Grid ── */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'linear-gradient(135deg,#0ea5e9,#0284c7)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="white" width="20">
                <path strokeWidth="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"/>
              </svg>
            </div>
            <div className="stat-content">
              <div className="stat-value">{renderStatValue(stats.activeDevices)}</div>
              <div className="stat-label">Active Devices</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="white" width="20">
                <path strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"/>
              </svg>
            </div>
            <div className="stat-content">
              <div className="stat-value">{renderStatValue(stats.totalData, (v) => Number(v).toLocaleString())}</div>
              <div className="stat-label">Total Records</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="white" width="20">
                <path strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
              </svg>
            </div>
            <div className="stat-content">
              <div className="stat-value">{renderStatValue(stats.alerts)}</div>
              <div className="stat-label">Critical Alerts</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="white" width="20">
                <path strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
              </svg>
            </div>
            <div className="stat-content">
              <div className="stat-value">{renderStatValue(stats.uptime, (v) => `${Number(v).toFixed(1)}%`)}</div>
              <div className="stat-label">Uptime</div>
            </div>
          </div>
        </div>

        {/* ── Live Sensor Updates ── */}
        {!streamConnected && <p className="loading-text">Connecting to live updates...</p>}
        <LiveChart onConnect={() => setStreamConnected(true)} initialData={recentData} />

        {/* ── Recent Sensor Readings ── */}
        <div className="data-section" ref={sensorRef}>
          <div className="section-header">
            <h2 className="section-title">Recent Sensor Readings</h2>
            {!loading && recentData.length > 0 && (
              <span className="sensor-count">{recentData.length} readings</span>
            )}
          </div>
          <div className="data-grid">
            {loading ? (
              <p className="loading-text">Loading sensor data...</p>
            ) : recentData.length === 0 ? (
              <p className="loading-text">No sensor readings yet.</p>
            ) : (
              visibleSensors.map((data) => (
                <div key={data.id} className="data-card">
                  <div className="data-header">
                    <span className="device-name">{data.device}</span>
                    <span className="status-badge" style={{
                      backgroundColor: getStatusColor(data.status) + '20',
                      color: getStatusColor(data.status),
                    }}>
                      {data.status}
                    </span>
                  </div>
                  <div className="data-body">
                    <span className="data-value">{data.value ?? 'N/A'}</span>
                    <span className="data-unit">{data.unit}</span>
                  </div>
                  <div className="data-footer">{data.time}</div>
                </div>
              ))
            )}
          </div>
          {!loading && recentData.length > SENSOR_PREVIEW && (
            <button className="show-more-btn" onClick={() => setShowAllSensors(p => !p)}>
              {showAllSensors ? '▲ Show Less' : `▼ Show ${recentData.length - SENSOR_PREVIEW} More Readings`}
            </button>
          )}
        </div>

        {/* ── Device Health Overview ── */}
        <div className="data-section">
          <div className="section-header">
            <h2 className="section-title">Device Health Overview</h2>
            <p className="section-subtitle">Real-time status with actionable alerts</p>
          </div>
          <div className="iot-devices-section">
            {loading ? (
              <p className="loading-text">Loading device status...</p>
            ) : recentData.length === 0 ? (
              <p className="loading-text">No device data available.</p>
            ) : (
              recentData.map((data) => (
                <IoTAlertCard
                  key={data.id}
                  device_id={data.device}
                  machine_name={data.device}
                  alert_level={data.status || 'normal'}
                  status_short={
                    data.status === 'critical'
                      ? `High temperature detected: ${data.value}${data.unit}. Immediate attention required.`
                      : data.status === 'warning'
                      ? `Temperature at ${data.value}${data.unit} — approaching threshold. Monitor closely.`
                      : `Operating normally at ${data.value}${data.unit}. All parameters within range.`
                  }
                  temperature={data.value}
                  vibration={data.vib}
                  power_usage={data.pwr}
                  recommendations={
                    data.status === 'critical'
                      ? ['Stop machine immediately and alert maintenance team','Check cooling system and ventilation','Do not restart until temperature drops below 70°C']
                      : data.status === 'warning'
                      ? ['Schedule inspection within the next 2 hours','Check cooling system for blockages','Reduce machine load if possible']
                      : ['Continue normal operation','Next scheduled maintenance on time','No action required at this time']
                  }
                  timestamp={data.time}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Device Activity Analytics ── */}
        <div className="chart-section">
          <div className="section-header">
            <div>
              <h2 className="section-title">Device Activity</h2>
              <p className="chart-description">{getActivityLabel(timePeriod)}</p>
            </div>
            <select className="time-select" value={timePeriod} onChange={e => setTimePeriod(e.target.value)}>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>

          {chartData.length > 0 && (
            <div className="chart-summary">
              <div className="chart-pill">
                <span className="pill-label">Total Scans</span>
                <span className="pill-value">{totalScans.toLocaleString()}</span>
              </div>
              <div className="chart-pill">
                <span className="pill-label">Total Alerts</span>
                <span className="pill-value" style={{ color: totalAlerts > 0 ? '#ef4444' : '#22c55e' }}>
                  {totalAlerts}
                </span>
              </div>
              <div className="chart-pill">
                <span className="pill-label">Peak Time</span>
                <span className="pill-value">{peakLabel}</span>
              </div>
              <div className="chart-pill">
                <span className="pill-label">Avg / Block</span>
                <span className="pill-value">{avgScans}</span>
              </div>
            </div>
          )}

          <div className="chart-wrapper">
            {chartData.length === 0 ? (
              <div className="chart-empty">
                <svg viewBox="0 0 48 48" width="40" height="40" fill="none">
                  <rect x="4"  y="28" width="8"  height="16" rx="2" fill="rgba(99,102,241,0.3)"/>
                  <rect x="16" y="18" width="8"  height="26" rx="2" fill="rgba(99,102,241,0.3)"/>
                  <rect x="28" y="22" width="8"  height="22" rx="2" fill="rgba(99,102,241,0.3)"/>
                  <rect x="40" y="10" width="8"  height="34" rx="2" fill="rgba(99,102,241,0.3)"/>
                </svg>
                <p>No activity data yet</p>
                <span>Data will appear as devices send readings</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 4" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#4b5563', fontSize: 11 }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                    tickLine={false}
                    label={{ value: timePeriod === '24h' ? 'Time (Hours)' : 'Time (Days)', position: 'insideBottom', offset: -10, fill: '#4b5563', fontSize: 11 }}
                  />
                  <YAxis
                    tick={{ fill: '#4b5563', fontSize: 11 }}
                    axisLine={false} tickLine={false} width={36}
                    label={{ value: 'Count', angle: -90, position: 'insideLeft', offset: 10, fill: '#4b5563', fontSize: 11 }}
                  />
                  <Tooltip content={<CustomTooltip timePeriod={timePeriod} />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Legend
                    verticalAlign="top" align="right" iconType="circle" iconSize={8}
                    formatter={(value) => (
                      <span style={{ color: '#94a3b8', fontSize: 11 }}>
                        {value === 'raw' ? 'Scans' : 'Alerts'}
                      </span>
                    )}
                    wrapperStyle={{ paddingBottom: 8 }}
                  />
                  {avgScans > 0 && (
                    <ReferenceLine y={avgScans} stroke="rgba(167,139,250,0.35)" strokeDasharray="4 3"
                      label={{ value: `Avg ${avgScans}`, position: 'right', fill: '#a78bfa', fontSize: 10 }}
                    />
                  )}
                  <Bar dataKey="raw" name="raw" radius={[4, 4, 0, 0]} maxBarSize={44}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={getBarColor(entry)} opacity={entry.raw === 0 ? 0.2 : 0.85} />
                    ))}
                  </Bar>
                  <Line
                    dataKey="alerts" name="alerts" type="monotone"
                    stroke="#ef4444" strokeWidth={2}
                    dot={(props) => {
                      const { cx, cy, payload, index } = props;
                      if (payload.alerts === 0) return null;
                      return <circle key={`dot-${index}`} cx={cx} cy={cy} r={4} fill="#ef4444" stroke="#0f1623" strokeWidth={2} />;
                    }}
                    activeDot={{ r: 5, fill: '#ef4444', stroke: '#0f1623', strokeWidth: 2 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>

          {chartData.length > 0 && (
            <div className="chart-legend">
              <span className="legend-item"><span className="legend-dot" style={{ background: '#6366f1' }}></span>Normal scans</span>
              <span className="legend-item"><span className="legend-dot" style={{ background: '#38bdf8' }}></span>High activity</span>
              <span className="legend-item"><span className="legend-dot" style={{ background: '#a78bfa' }}></span>Peak</span>
              <span className="legend-item"><span className="legend-dot" style={{ background: '#ef4444', borderRadius: '50%' }}></span>Alerts</span>
            </div>
          )}
        </div>

      </div>
    </Layout>
  );
};

export default DashboardPage;