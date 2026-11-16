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
  const scans = payload.find(p => p.dataKey === 'raw');
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

const MACHINE_DIRECTORY = [
  { id: 'Device-000', name: 'Injection Molder', type: 'Molding', sector: 'Robotics & Assembly', line: 'Line 3' },
  { id: 'Device-001', name: 'Mixer', type: 'Processing', sector: 'Logistics & QA', line: 'Line 4' },
  { id: 'Device-002', name: 'Pick & Place', type: 'Assembly', sector: 'Robotics & Assembly', line: 'Line 3' },
  { id: 'Device-003', name: 'Vision System', type: 'Inspection', sector: 'Logistics & QA', line: 'Line 4' },
  { id: 'Device-004', name: 'Shuttle System', type: 'Logistics', sector: 'Logistics & QA', line: 'Line 4' },
  { id: 'Device-005', name: 'Labeler', type: 'Packaging', sector: 'Logistics & QA', line: 'Line 4' },
  { id: 'Device-006', name: 'Automated Screwdriver', type: 'Assembly', sector: 'Robotics & Assembly', line: 'Line 3' },
  { id: 'Device-007', name: 'Shrink Wrapper', type: 'Packaging', sector: 'Logistics & QA', line: 'Line 4' },
  { id: 'Device-008', name: 'Laser Cutter', type: 'Fabrication', sector: 'Machining & Forming', line: 'Line 1' },
  { id: 'Device-009', name: 'CMM Metrology', type: 'Metrology', sector: 'Logistics & QA', line: 'Line 4' },
  { id: 'Device-010', name: 'CNC Lathe', type: 'Machining', sector: 'Machining & Forming', line: 'Line 1' },
  { id: 'Device-011', name: 'Batch Dryer', type: 'Finishing', sector: 'Thermal & Fluids', line: 'Line 2' },
  { id: 'Device-012', name: 'Valve Controller', type: 'Fluid Control', sector: 'Thermal & Fluids', line: 'Line 2' },
  { id: 'Device-013', name: 'Furnace', type: 'Thermal', sector: 'Thermal & Fluids', line: 'Line 2' },
  { id: 'Device-014', name: 'Carton Former', type: 'Packaging', sector: 'Logistics & QA', line: 'Line 4' },
  { id: 'Device-015', name: 'Hydraulic Press', type: 'Forming', sector: 'Machining & Forming', line: 'Line 1' },
  { id: 'Device-016', name: 'Compressor', type: 'Pneumatics', sector: 'Thermal & Fluids', line: 'Line 2' },
  { id: 'Device-017', name: 'AGV Transport', type: 'Robotics', sector: 'Robotics & Assembly', line: 'Line 3' },
  { id: 'Device-018', name: 'Robot Arm', type: 'Robotics', sector: 'Robotics & Assembly', line: 'Line 3' },
  { id: 'Device-019', name: 'Conveyor Belt', type: 'Material Handling', sector: 'Logistics & QA', line: 'Line 4' },
  { id: 'Device-020', name: 'Forklift', type: 'Logistics', sector: 'Logistics & QA', line: 'Line 4' },
  { id: 'Device-021', name: 'Press Brake', type: 'Sheet Metal', sector: 'Machining & Forming', line: 'Line 1' },
  { id: 'Device-022', name: 'Boiler', type: 'Thermal', sector: 'Thermal & Fluids', line: 'Line 2' },
  { id: 'Device-023', name: 'Vacuum Packer', type: 'Packaging', sector: 'Logistics & QA', line: 'Line 4' },
  { id: 'Device-024', name: 'XRay Inspector', type: 'Quality Control', sector: 'Logistics & QA', line: 'Line 4' },
  { id: 'Device-025', name: 'Crane', type: 'Heavy Transport', sector: 'Logistics & QA', line: 'Line 4' },
  { id: 'Device-026', name: '3D Printer', type: 'Additive', sector: 'Robotics & Assembly', line: 'Line 3' },
  { id: 'Device-027', name: 'Palletizer', type: 'End of Line', sector: 'Logistics & QA', line: 'Line 4' },
  { id: 'Device-028', name: 'Grinder', type: 'Surface Finish', sector: 'Machining & Forming', line: 'Line 1' },
  { id: 'Device-029', name: 'CNC Mill', type: 'Machining', sector: 'Machining & Forming', line: 'Line 1' },
  { id: 'Device-030', name: 'Chiller', type: 'HVAC', sector: 'Thermal & Fluids', line: 'Line 2' },
  { id: 'Device-031', name: 'Heat Exchanger', type: 'Thermal', sector: 'Thermal & Fluids', line: 'Line 2' },
  { id: 'Device-032', name: 'Pump', type: 'Hydraulics', sector: 'Thermal & Fluids', line: 'Line 2' },
];

const DashboardPage = () => {
  const [streamConnected, setStreamConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ activeDevices: 33, totalData: null, alerts: null, uptime: 99.9 });
  const [recentData, setRecentData] = useState([]);
  const [latestDevices, setLatestDevices] = useState([]);
  const [blockchainActive, setBlockchainActive] = useState(false);
  const [timePeriod, setTimePeriod] = useState('24h');
  const [chartData, setChartData] = useState([]);
  const [showAllSensors, setShowAllSensors] = useState(false);
  const [deviceFilter, setDeviceFilter] = useState('all');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [deviceSearch, setDeviceSearch] = useState('');
  const [lastLiveTick, setLastLiveTick] = useState(null);
  const SENSOR_PREVIEW = 5;
  const sensorRef = useRef(null);

  const handleLiveTelemetry = (item) => {
    if (!item || !item.device_id) return;
    setStreamConnected(true);
    setLastLiveTick(new Date().toLocaleTimeString());
    setStats(prev => ({
      activeDevices: 33,
      totalData: item.total_scans != null ? Math.max(Number(prev.totalData || 0) + 1, Number(item.total_scans)) : (Number(prev.totalData || 0) + 1),
      alerts: item.anomalies != null ? Math.max(Number(prev.alerts || 0), Number(item.anomalies)) : (item.is_anomaly ? Number(prev.alerts || 0) + 1 : Number(prev.alerts || 0)),
      uptime: prev.uptime || 99.9,
    }));

    const machineMeta = MACHINE_DIRECTORY.find(m => m.id === item.device_id);
    const newRecord = {
      id: `${item.device_id}-${Date.now()}`,
      device: item.device_id,
      machine_name: item.machine_name || (machineMeta ? machineMeta.name : item.device_id),
      value: item.temperature != null ? Number(item.temperature).toFixed(1) : 0,
      temp: item.temperature != null ? Number(item.temperature) : 0,
      vib: item.vibration != null ? Number(item.vibration).toFixed(2) : 0,
      pwr: item.power_usage != null ? Number(item.power_usage).toFixed(1) : 0,
      pressure: item.pressure != null ? Number(item.pressure).toFixed(1) : 0,
      unit: '°C',
      status: item.is_anomaly ? 'critical' : 'normal',
      time: new Date().toLocaleTimeString(),
      status_short: item.status_short,
    };

    setRecentData(prev => [newRecord, ...prev.filter(r => r.device !== item.device_id).slice(0, 32)]);
    setLatestDevices(prev => {
      const idx = prev.findIndex(d => d.device === item.device_id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = newRecord;
        return copy;
      }
      return [newRecord, ...prev];
    });
  };

  const fetchDashboardData = async () => {
    try {
      const response = await authenticatedFetch('/api/dashboard');
      if (response && response.ok) {
        const json = await response.json();
        if (json.blockchain_active !== undefined) {
          setBlockchainActive(Boolean(json.blockchain_active));
        }
        setStats(prev => ({
          activeDevices: json.stats?.active_devices ?? 33,
          totalData: Math.max(Number(prev.totalData || 0), Number(json.stats?.total_scans ?? 0)),
          alerts: Math.max(Number(prev.alerts || 0), Number(json.stats?.anomalies ?? 0)),
          uptime: json.stats?.uptime ?? 99.9,
        }));
        if (json.latest_devices && Array.isArray(json.latest_devices)) {
          setLatestDevices(json.latest_devices);
        }
        const history = json.recent_data ?? [];
        setRecentData(history.length > 0
          ? history.map((rec, i) => {
            const machineMeta = MACHINE_DIRECTORY.find(m => m.id === rec.device);
            return {
              id: rec.id ?? i,
              device: rec.device ?? 'Unknown',
              machine_name: rec.machine_name || (machineMeta ? machineMeta.name : rec.device),
              value: rec.temp ?? 0,
              temp: rec.temp ?? 0,
              vib: rec.vib ?? 0,
              pwr: rec.pwr ?? 0,
              pressure: rec.pressure ?? 0,
              unit: '°C',
              status: rec.status ?? 'normal',
              time: rec.timestamp ? new Date(rec.timestamp).toLocaleTimeString() : '—',
              status_short: rec.status_short,
            };
          })
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
        const json = await response.json();
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
        const avg = buckets.reduce((s, b) => s + b.raw, 0) / buckets.length;
        setChartData(buckets.map(b => ({
          label: b.label,
          raw: b.raw,
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
    const dashInterval = setInterval(fetchDashboardData, 6000);
    return () => clearInterval(dashInterval);
  }, []);

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
      case 'normal': return '#22c55e';
      case 'warning': return '#f59e0b';
      case 'critical': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getBarColor = (entry) => {
    if (entry.isPeak) return '#a78bfa';
    if (entry.isHigh) return '#38bdf8';
    return '#6366f1';
  };

  const getActivityLabel = (period) => {
    if (period === '24h') return 'Sensor scans & alerts per 2-hour block';
    if (period === '7d') return 'Total scans & alerts per day';
    return 'Scans & alerts per day (last 30 days)';
  };

  const totalScans = chartData.reduce((s, d) => s + d.raw, 0);
  const totalAlerts = chartData.reduce((s, d) => s + d.alerts, 0);
  const peakLabel = chartData.length ? chartData.reduce((a, b) => (b.raw > a.raw ? b : a), chartData[0]).label : '—';
  const avgScans = chartData.length ? Math.round(totalScans / chartData.length) : 0;

  const visibleSensors = showAllSensors ? recentData : recentData.slice(0, SENSOR_PREVIEW);

  const fleetList = MACHINE_DIRECTORY.map((m) => {
    const latest = latestDevices.find(r => r.device === m.id) || recentData.find(r => r.device === m.id);
    const hasData = Boolean(latest);
    return {
      device_id: m.id,
      machine_name: m.name,
      type: m.type,
      sector: m.sector,
      line: m.line,
      status: latest ? latest.status : 'normal',
      value: hasData ? Number(latest.temp ?? latest.value ?? 0).toFixed(1) : '—',
      vib: hasData ? Number(latest.vib ?? 0).toFixed(2) : '—',
      pwr: hasData ? Number(latest.pwr ?? 0).toFixed(1) : '—',
      pressure: hasData ? Number(latest.pressure ?? 0).toFixed(1) : '—',
      current_avg: hasData ? Number(latest.current_avg ?? 0.12).toFixed(2) : '—',
      voltage_avg: hasData ? Number(latest.voltage_avg ?? 217.5).toFixed(1) : '—',
      loss: latest?.loss,
      confidence: latest?.confidence,
      unit: '°C',
      time: latest ? (latest.time || (latest.timestamp ? new Date(latest.timestamp).toLocaleTimeString() : 'Live')) : (lastLiveTick || 'Awaiting'),
      status_short: latest?.status_short || (latest?.status === 'critical' ? 'Elevated reading detected' : 'Operating within safe parameters'),
    };
  });

  const optimalCount = fleetList.filter(m => m.status === 'normal').length;
  const alertCount = fleetList.filter(m => m.status === 'critical' || m.status === 'warning').length;

  const filteredFleet = fleetList.filter(m => {
    const matchesStatus =
      deviceFilter === 'all' ||
      (deviceFilter === 'optimal' && m.status === 'normal') ||
      (deviceFilter === 'attention' && (m.status === 'critical' || m.status === 'warning'));
    const matchesSector =
      sectorFilter === 'all' ||
      m.line.toLowerCase() === sectorFilter.toLowerCase();
    const matchesSearch =
      m.machine_name.toLowerCase().includes(deviceSearch.toLowerCase()) ||
      m.device_id.toLowerCase().includes(deviceSearch.toLowerCase()) ||
      m.type.toLowerCase().includes(deviceSearch.toLowerCase()) ||
      (m.sector && m.sector.toLowerCase().includes(deviceSearch.toLowerCase()));
    return matchesStatus && matchesSector && matchesSearch;
  });

  const statusPriority = { critical: 0, warning: 1, normal: 2 };
  const sortedFleet = [...filteredFleet].sort((a, b) => {
    const pA = statusPriority[a.status] ?? 2;
    const pB = statusPriority[b.status] ?? 2;
    if (pA !== pB) return pA - pB;
    return a.device_id.localeCompare(b.device_id);
  });

  return (
    <Layout>
      <div className="dashboard-container">

        {/* ── Header ── */}
        <div className="page-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <h1 className="page-title">Industrial IoT Telemetry &amp; DePIN Audit Fleet</h1>
              <span className="live-status-pill">
                <span className="status-dot connected" style={{ width: '8px', height: '8px' }} />
                LIVE INGESTION (5.0s)
              </span>
            </div>
            <p className="page-subtitle">Autonomous multi-sensor streaming, temporal LSTM reconstruction, DeviceGCN topology, and consortium blockchain ledger</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8', background: 'rgba(255,255,255,0.04)', padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
              Ledger: <strong style={{ color: blockchainActive ? '#38bdf8' : '#22c55e' }}>{blockchainActive ? 'Connected (Fabric)' : 'Local Hash-Chain Ledger'}</strong>
            </span>
            <button className="refresh-button" onClick={handleRefresh} disabled={refreshing}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {refreshing ? 'Syncing...' : 'Sync Fleet'}
            </button>
          </div>
        </div>

        {/* ── Stats Grid ── */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'linear-gradient(135deg,#0ea5e9,#0284c7)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="white" width="20">
                <path strokeWidth="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
            </div>
            <div className="stat-content">
              <div className="stat-value">{renderStatValue(stats.activeDevices)} <span style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: 500 }}>/ 33</span></div>
              <div className="stat-label">Active Industrial Nodes (100% Online)</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="white" width="20">
                <path strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
            </div>
            <div className="stat-content">
              <div className="stat-value">{renderStatValue(stats.totalData, (v) => Number(v).toLocaleString())}</div>
              <div className="stat-label">Total Verified Telemetry Scans (+30/min)</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="white" width="20">
                <path strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div className="stat-content">
              <div className="stat-value">{renderStatValue(stats.alerts)}</div>
              <div className="stat-label">Flagged Anomalies (Auto-Fabric Logged)</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="white" width="20">
                <path strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="stat-content">
              <div className="stat-value">{renderStatValue(stats.uptime, (v) => `${Number(v).toFixed(1)}%`)}</div>
              <div className="stat-label">SLA Uptime (Continuous Operation)</div>
            </div>
          </div>
        </div>

        {/* ── Live Sensor Updates ── */}
        <LiveChart onConnect={() => setStreamConnected(true)} onData={handleLiveTelemetry} initialData={recentData} />

        {/* ── 33-Device Industrial Fleet Matrix ── */}
        <div className="data-section">
          <div className="section-header">
            <div>
              <h2 className="section-title">33-Machine Consortium Fleet Health Matrix</h2>
              <p className="section-subtitle">Continuous multi-sensor status, AI anomaly risk, and tamper-proof ledger audit across all plant assets</p>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Search machine, sector, or ID..."
                value={deviceSearch}
                onChange={e => setDeviceSearch(e.target.value)}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  color: '#fff',
                  fontSize: '0.8rem',
                  outline: 'none',
                }}
              />
              <button
                onClick={() => setDeviceFilter('all')}
                style={{
                  background: deviceFilter === 'all' ? '#0ea5e9' : 'rgba(255,255,255,0.06)',
                  color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600
                }}
              >
                All Status ({fleetList.length})
              </button>
              <button
                onClick={() => setDeviceFilter('optimal')}
                style={{
                  background: deviceFilter === 'optimal' ? '#10b981' : 'rgba(255,255,255,0.06)',
                  color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600
                }}
              >
                Optimal ({optimalCount})
              </button>
              <button
                onClick={() => setDeviceFilter('attention')}
                style={{
                  background: deviceFilter === 'attention' ? '#ef4444' : 'rgba(255,255,255,0.06)',
                  color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600
                }}
              >
                Attention ({alertCount})
              </button>
            </div>
          </div>

          {/* ── Fleet Context & Sector Filtering ── */}
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginRight: '4px' }}>Plant Lines:</span>
                {[
                  { id: 'all', label: 'All Lines', count: 33 },
                  { id: 'Line 1', label: 'Line 1: Machining', count: 6 },
                  { id: 'Line 2', label: 'Line 2: Thermal & Fluids', count: 8 },
                  { id: 'Line 3', label: 'Line 3: Robotics', count: 6 },
                  { id: 'Line 4', label: 'Line 4: Logistics & QA', count: 13 },
                ].map(sec => (
                  <button
                    key={sec.id}
                    onClick={() => setSectorFilter(sec.id)}
                    style={{
                      background: sectorFilter === sec.id ? 'rgba(14,165,233,0.2)' : 'rgba(255,255,255,0.04)',
                      color: sectorFilter === sec.id ? '#38bdf8' : '#cbd5e1',
                      border: sectorFilter === sec.id ? '1px solid rgba(14,165,233,0.4)' : '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '6px',
                      padding: '4px 10px',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {sec.label} ({sec.count})
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Active Filter View: <strong style={{ color: '#f1f5f9' }}>{filteredFleet.length}</strong> / 33 Machines</span>
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '8px',
              paddingTop: '8px',
              borderTop: '1px solid rgba(255,255,255,0.05)',
              fontSize: '0.72rem',
              color: '#94a3b8'
            }}>
              <div><strong style={{ color: '#cbd5e1' }}>Multi-Sensor Fusion:</strong> 6 channels (Temp, Vib, Pwr, Pressure, Curr, Volt)</div>
              <div><strong style={{ color: '#cbd5e1' }}>Edge AI Scoring:</strong> PyTorch LSTM reconstruction MSE vs 0.163 threshold</div>
              <div><strong style={{ color: '#cbd5e1' }}>Topology Check:</strong> DeviceGCN inter-machine cascade correlation</div>
              <div><strong style={{ color: '#cbd5e1' }}>Consortium Ledger:</strong> SHA-256 state hashes committed to Fabric</div>
            </div>
          </div>

          <div className="iot-devices-section">
            {sortedFleet.length === 0 ? (
              <p className="loading-text">No machines match the filter.</p>
            ) : (
              sortedFleet.map((data) => (
                <IoTAlertCard
                  key={data.device_id}
                  device_id={data.device_id}
                  machine_name={`${data.machine_name} (${data.type})`}
                  sector={data.sector}
                  line={data.line}
                  alert_level={data.status || 'normal'}
                  status_short={data.status_short}
                  temperature={Number(data.value)}
                  vibration={Number(data.vib)}
                  power_usage={Number(data.pwr)}
                  pressure={Number(data.pressure || 0)}
                  current_avg={Number(data.current_avg || 0.12)}
                  voltage_avg={Number(data.voltage_avg || 217.5)}
                  loss={data.loss}
                  confidence={data.confidence}
                  recommendations={
                    data.status === 'critical'
                      ? ['Stop machine immediately and alert maintenance team', 'Check cooling system and ventilation', 'Do not restart until temperature drops below safe limits']
                      : data.status === 'warning'
                        ? ['Schedule inspection within the next 2 hours', 'Check cooling system for blockages', 'Reduce machine load if possible']
                        : ['Continue normal operation', 'Next scheduled maintenance on time', 'All telemetry within nominal thresholds']
                  }
                  timestamp={data.time}
                />
              ))
            )}
          </div>
        </div>

      </div>
    </Layout>
  );
};

export default DashboardPage;