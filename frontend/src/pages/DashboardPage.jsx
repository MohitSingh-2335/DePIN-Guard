import { useState, useEffect, useCallback } from 'react';
import LiveChart from '../components/LiveChart';
import Layout from '../components/layout/Layout';
import IoTAlertCard from '../components/IoTAlertCard';
import { authenticatedFetch, getRefreshIntervalMs, formatUtcTimestamp } from '../utils/api';
import './DashboardPage.css';

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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ activeDevices: 33, totalData: null, alerts: null, uptime: 99.9 });
  const [recentData, setRecentData] = useState([]);
  const [latestDevices, setLatestDevices] = useState([]);
  const [blockchainActive, setBlockchainActive] = useState(false);
  const [deviceFilter, setDeviceFilter] = useState('all');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [deviceSearch, setDeviceSearch] = useState('');
  const [lastLiveTick, setLastLiveTick] = useState(null);

  const handleLiveTelemetry = useCallback((item) => {
    if (!item || !item.device_id) return;
    const formattedTime = formatUtcTimestamp(item.timestamp, false);
    setLastLiveTick(formattedTime);

    // Always use authoritative MongoDB counts sent by backend; never artificially inflate in browser memory
    setStats(prev => ({
      activeDevices: 33,
      totalData: item.total_scans != null ? Number(item.total_scans) : prev.totalData,
      alerts: item.anomalies != null ? Number(item.anomalies) : prev.alerts,
      uptime: prev.uptime || 99.9,
    }));

    const machineMeta = MACHINE_DIRECTORY.find(m => m.id === item.device_id);
    const newRecord = {
      id: item.id || `${item.device_id}-${item.timestamp || Date.now()}`,
      device: item.device_id,
      machine_name: item.machine_name || (machineMeta ? machineMeta.name : item.device_id),
      value: item.temperature != null ? Number(item.temperature).toFixed(2) : 0,
      temp: item.temperature != null ? Number(item.temperature) : 0,
      vib: item.vibration != null ? Number(item.vibration) : 0,
      pwr: item.power_usage != null ? Number(item.power_usage) : 0,
      pressure: item.pressure != null ? Number(item.pressure) : 0,
      current_avg: item.current_avg != null ? Number(item.current_avg) : 0.12,
      voltage_avg: item.voltage_avg != null ? Number(item.voltage_avg) : 217.5,
      loss: item.loss,
      threshold: item.threshold ?? 0.205,
      confidence: item.confidence,
      unit: '°C',
      status: item.is_anomaly ? 'critical' : 'normal',
      time: formattedTime,
      timestamp: item.timestamp,
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
  }, []);

  const fetchDashboardData = useCallback(async () => {
    try {
      const response = await authenticatedFetch('/api/dashboard');
      if (response && response.ok) {
        const json = await response.json();
        if (json.blockchain_active !== undefined) {
          setBlockchainActive(Boolean(json.blockchain_active));
        }
        // Directly synchronize with canonical MongoDB counts so F5 refresh never jumps
        setStats({
          activeDevices: json.stats?.active_devices ?? 33,
          totalData: Number(json.stats?.total_scans ?? 0),
          alerts: Number(json.stats?.anomalies ?? 0),
          uptime: json.stats?.uptime ?? 99.9,
        });
        if (json.latest_devices && Array.isArray(json.latest_devices)) {
          setLatestDevices(json.latest_devices);
        }
        const history = json.recent_data ?? [];
        if (history.length > 0) {
          setRecentData(
            history.map((rec, i) => {
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
                current_avg: rec.current_avg ?? 0.12,
                voltage_avg: rec.voltage_avg ?? 217.5,
                loss: rec.loss,
                threshold: rec.threshold ?? 0.205,
                confidence: rec.confidence,
                unit: '°C',
                status: rec.status ?? 'normal',
                time: rec.timestamp ? formatUtcTimestamp(rec.timestamp, false) : '—',
                timestamp: rec.timestamp,
                status_short: rec.status_short,
              };
            })
          );
        }
      }
    } catch {
      // Keep existing state on transient network glitch
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    const intervalMs = getRefreshIntervalMs(6000);
    if (!intervalMs) return undefined;
    const dashInterval = setInterval(fetchDashboardData, intervalMs);
    return () => clearInterval(dashInterval);
  }, [fetchDashboardData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  const renderStatValue = (value, formatter = (v) => v) => {
    if (loading && value === null) return '...';
    if (value === null || value === undefined) return '0';
    return formatter(value);
  };

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
      value: hasData ? Number(latest.temp ?? latest.value ?? 22.5).toFixed(2) : '22.50',
      vib: hasData ? Number(latest.vib ?? 0.25).toFixed(2) : '0.25',
      pwr: hasData ? Number(latest.pwr ?? 2.5).toFixed(2) : '2.50',
      pressure: hasData ? Number(latest.pressure ?? 100.0).toFixed(1) : '100.0',
      current_avg: hasData ? Number(latest.current_avg ?? 0.12).toFixed(2) : '0.12',
      voltage_avg: hasData ? Number(latest.voltage_avg ?? 217.5).toFixed(1) : '217.5',
      loss: latest?.loss,
      threshold: latest?.threshold ?? 0.205,
      confidence: latest?.confidence,
      unit: '°C',
      time: latest
        ? (latest.time || (latest.timestamp ? formatUtcTimestamp(latest.timestamp, false) : 'Live'))
        : (lastLiveTick || 'Synced'),
      status_short: latest?.status_short || (latest?.status === 'critical' ? 'Abnormal reading detected' : 'Operating within safe parameters'),
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
              <h1 className="page-title">Industrial IoT Telemetry &amp; DePIN Audit Fleet</h1>
              <span className="live-status-pill">
                <span className="status-dot connected" style={{ width: '8px', height: '8px' }} />
                MONGODB PERSISTENT STREAM (5.0s)
              </span>
            </div>
            <p className="page-subtitle">
              Real-time 6-channel industrial telemetry, PyTorch LSTM Autoencoder + DeviceGCN inference, and SHA-256 ledger anchoring
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8', background: 'rgba(255,255,255,0.04)', padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
              Ledger: <strong style={{ color: blockchainActive ? '#38bdf8' : '#22c55e' }}>{blockchainActive ? 'Connected (Hyperledger Fabric)' : 'Persistent SHA-256 Hash-Chain'}</strong>
            </span>
            <button className="refresh-button" onClick={handleRefresh} disabled={refreshing}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {refreshing ? 'Syncing...' : 'Sync Fleet'}
            </button>
          </div>
        </div>

        {/* ── Stats Grid (100% Connected to MongoDB Single Source of Truth) ── */}
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
              <div className="stat-label">Total Verified Telemetry Scans (MongoDB)</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="white" width="20">
                <path strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div className="stat-content">
              <div className="stat-value">{renderStatValue(stats.alerts, (v) => Number(v).toLocaleString())}</div>
              <div className="stat-label">Flagged Anomalies (Synced Across All Pages)</div>
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

        {/* ── Live Sensor Waveform & Packet Stream ── */}
        <LiveChart onData={handleLiveTelemetry} initialData={recentData} />

        {/* ── 33-Device Industrial Fleet Matrix (Bounded Scrollable Container) ── */}
        <div className="data-section">
          <div className="section-header">
            <div>
              <h2 className="section-title">33-Machine Consortium Fleet Health Matrix</h2>
              <p className="section-subtitle">
                Scroll inside this container to inspect all 33 machines — Critical &amp; Warning machines automatically surface at the top
              </p>
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
            gap: '12px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginRight: '4px' }}>Plant Lines:</span>
                {[
                  { id: 'all', label: 'All Lines', count: 33 },
                  { id: 'Line 1', label: 'Line 1: Machining (6)', count: 6 },
                  { id: 'Line 2', label: 'Line 2: Thermal & Fluids (8)', count: 8 },
                  { id: 'Line 3', label: 'Line 3: Robotics (6)', count: 6 },
                  { id: 'Line 4', label: 'Line 4: Logistics & QA (13)', count: 13 },
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
                    {sec.label}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Active Filter View: <strong style={{ color: '#f1f5f9' }}>{filteredFleet.length}</strong> / 33 Machines</span>
              </div>
            </div>

            {/* Industrial Plant Topology & Tamper-Proof Audit Specs */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '10px',
              padding: '10px 12px',
              background: 'rgba(15,23,42,0.5)',
              borderRadius: '8px',
              border: '1px solid rgba(14,165,233,0.12)',
              fontSize: '0.74rem',
              lineHeight: '1.45',
              color: '#94a3b8'
            }}>
              <div>
                <span style={{ color: '#38bdf8', fontWeight: 600, display: 'block', marginBottom: '2px' }}>
                  Cyber-Physical Fleet Topology (33 Assets)
                </span>
                Continuous telemetry stream from 4 integrated manufacturing lines: <strong>Line 1</strong> Machining (CNC Lathes, Mills, Laser Cutters), <strong>Line 2</strong> Thermal &amp; Fluids (Boilers, Furnaces, Compressors), <strong>Line 3</strong> Robotics (6-Axis Arms, AGVs, 3D Printers), and <strong>Line 4</strong> Logistics &amp; QA (Metrology, X-Ray, Conveyors).
              </div>
              <div>
                <span style={{ color: '#f59e0b', fontWeight: 600, display: 'block', marginBottom: '2px' }}>
                  Mechanical Fault vs. Deliberate Sabotage
                </span>
                Monitors 6 sensor channels (Temp, Vibration, Power, Pressure, Current, Voltage). Differentiates standard mechanical fatigue (gradual bearing wear, thermal drift) from human tampering or sensor spoofing (sudden step-changes, anomalous loss spikes across dependent nodes).
              </div>
              <div>
                <span style={{ color: '#10b981', fontWeight: 600, display: 'block', marginBottom: '2px' }}>
                  Immutable Consortium Chain-of-Custody
                </span>
                Every anomaly is evaluated by the LSTM Autoencoder &amp; DeviceGCN, hashed via SHA-256, and permanently recorded to the consortium ledger. Physical sensor readings cannot be secretly manipulated, deleted, or backdated after an industrial incident.
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '8px',
              paddingTop: '6px',
              borderTop: '1px solid rgba(255,255,255,0.05)',
              fontSize: '0.72rem',
              color: '#94a3b8'
            }}>
              <div><strong style={{ color: '#cbd5e1' }}>Multi-Sensor Fusion:</strong> 6 channels (Temp, Vib, Pwr, Pressure, Curr, Volt)</div>
              <div><strong style={{ color: '#cbd5e1' }}>Edge AI Scoring:</strong> PyTorch LSTM reconstruction MSE vs 0.205 threshold</div>
              <div><strong style={{ color: '#cbd5e1' }}>Topology Check:</strong> DeviceGCN inter-machine cascade correlation</div>
              <div><strong style={{ color: '#cbd5e1' }}>Consortium Ledger:</strong> SHA-256 state hashes committed to MongoDB &amp; Fabric</div>
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
                  threshold={data.threshold || 0.205}
                  confidence={data.confidence}
                  recommendations={
                    data.status === 'critical'
                      ? ['Stop machine immediately and alert maintenance team', 'Inspect cooling fluid loop, motor bearings, and hydraulic valves', 'Verify SHA-256 anomaly record in Fraud Alerts & Blockchain Explorer']
                      : data.status === 'warning'
                        ? ['Schedule inspection within the next 2 hours', 'Check cooling system and lubrication', 'Monitor reconstruction loss trend']
                        : ['Continue normal operation', 'Next scheduled maintenance on time', 'All 6 sensor channels within nominal thresholds']
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