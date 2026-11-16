import { useState, useEffect, useCallback } from 'react';
import Layout from '../components/layout/Layout';
import { authenticatedFetch, getRefreshIntervalMs, formatUtcTimestamp } from '../utils/api';
import './HistoryPage.css';

const HistoryPage = () => {
  const [historyData, setHistoryData] = useState([]);
  const [totals, setTotals] = useState({ scans: null, anomalies: null, normal: null });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState(null);
  const itemsPerPage = 12;

  const fetchHistory = useCallback(async () => {
    try {
      const res = await authenticatedFetch('/api/history/all');
      if (res?.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.history)) {
          setHistoryData(data.history);
          setTotals({
            scans: data.total_scans ?? data.history.length,
            anomalies: data.total_anomalies ?? data.history.filter(r => r.anomaly === 1 || r.status === 'critical').length,
            normal: data.total_normal ?? Math.max(0, (data.total_scans ?? data.history.length) - (data.total_anomalies ?? 0)),
          });
        }
      }
    } catch (error) {
      console.error('[History] Fetch failed:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
    const intervalMs = getRefreshIntervalMs(6000);
    if (!intervalMs) return undefined;
    const interval = setInterval(fetchHistory, intervalMs);
    return () => clearInterval(interval);
  }, [fetchHistory]);

  const getStatusClass = (status) => {
    const s = status?.toLowerCase();
    if (s === 'verified' || s === 'normal') return 'status-success';
    if (s === 'critical' || s === 'failed') return 'status-danger';
    if (s === 'pending') return 'status-warning';
    return 'status-info';
  };

  const filteredData = historyData.filter(item => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      (item.device ?? '').toLowerCase().includes(term) ||
      (item.machine_name ?? '').toLowerCase().includes(term) ||
      (item.hash ?? '').toLowerCase().includes(term) ||
      (item.id ?? '').toLowerCase().includes(term);
    const matchesFilter =
      filterStatus === 'all' ||
      (filterStatus === 'verified' && (item.status === 'verified' || item.status === 'normal')) ||
      (filterStatus === 'critical' && (item.status === 'critical' || item.anomaly === 1));
    return matchesSearch && matchesFilter;
  });

  const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));
  const currentData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleExportCSV = () => {
    const headers = ['ID', 'Device', 'Machine', 'Hash', 'Status', 'Temperature_C', 'Vibration_mms', 'Power_kW', 'Pressure_bar', 'Loss', 'Confidence', 'Timestamp'];
    const csvRows = filteredData.map(h =>
      `"${h.id}","${h.device}","${h.machine_name || h.device}","${h.hash}","${h.status}",${h.temp},${h.vib},${h.pwr},${h.pressure || 0},${h.loss || 0},${h.confidence || 0},"${h.timestamp}"`
    );
    const blob = new Blob([[headers.join(','), ...csvRows].join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `depin-audit-log-${new Date().getTime()}.csv`;
    a.click();
  };

  return (
    <Layout>
      <div className="history-container">

        {/* Header & Export */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Network Audit &amp; Telemetry Logs</h1>
            <p className="page-subtitle">Cryptographic ledger and sensor telemetry history verified across consortium nodes (MongoDB)</p>
          </div>
          <button className="export-button" onClick={handleExportCSV}>
            Export Audit CSV
          </button>
        </div>

        {/* Mini Stats Grid (100% Identical to Dashboard & AI Analysis) */}
        <div className="history-stats-grid">
          <div className="stat-card">
            <span className="stat-label">Total Verified Records (MongoDB)</span>
            <span className="stat-value">
              {totals.scans !== null ? Number(totals.scans).toLocaleString() : historyData.length}
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Critical Anomaly Logs (MongoDB)</span>
            <span className="stat-value text-danger">
              {totals.anomalies !== null ? Number(totals.anomalies).toLocaleString() : historyData.filter(h => h.status === 'critical' || h.anomaly === 1).length}
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Optimal Machine Scans (MongoDB)</span>
            <span className="stat-value text-success">
              {totals.normal !== null ? Number(totals.normal).toLocaleString() : historyData.filter(h => h.status === 'verified' || h.status === 'normal').length}
            </span>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="controls-section">
          <div className="search-wrapper">
            <input
              type="text"
              placeholder="Search by Node ID, Machine Name, Hash, or Mongo ID..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="search-input"
            />
          </div>
          <div className="filter-wrapper">
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
              className="filter-select"
            >
              <option value="all">All Telemetry Logs ({historyData.length} recent)</option>
              <option value="verified">Verified / Normal Only</option>
              <option value="critical">Critical Anomalies Only</option>
            </select>
          </div>
        </div>

        {/* Activity Table */}
        <div className="table-container">
          {loading ? (
            <div className="loader">Syncing telemetry logs with MongoDB &amp; Ledger...</div>
          ) : filteredData.length === 0 ? (
            <div className="empty-state">No matching activity logs found.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cryptographic Hash</th>
                  <th>Node Machine</th>
                  <th>Telemetry Readings</th>
                  <th>AI Loss / Conf</th>
                  <th>Audit Status</th>
                  <th>Recorded Time</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {currentData.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <code className="id-badge" style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#38bdf8' }}>
                        {item.hash ? `${item.hash.slice(0, 14)}...` : String(item.id).slice(-8)}
                      </code>
                    </td>
                    <td>
                      <strong className="node-code">{item.device}</strong>
                      {item.machine_name && item.machine_name !== item.device && (
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{item.machine_name}</div>
                      )}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                      {Number(item.temp).toFixed(2)}°C · {Number(item.vib).toFixed(2)} mm/s · {Number(item.pwr).toFixed(2)} kW {item.pressure ? `· ${Number(item.pressure).toFixed(1)} bar` : ''}
                    </td>
                    <td style={{ fontSize: '0.78rem' }}>
                      <span style={{ color: item.loss > item.threshold ? '#ef4444' : '#94a3b8', fontWeight: 600 }}>
                        {item.loss !== undefined ? Number(item.loss).toFixed(4) : '—'}
                      </span>
                      {item.confidence ? (
                        <span style={{ color: '#38bdf8', marginLeft: '6px', fontSize: '0.72rem' }}>
                          ({Number(item.confidence).toFixed(1)}%)
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <span className={`status-pill ${getStatusClass(item.status)}`}>
                        {item.status === 'critical' || item.anomaly === 1 ? 'CRITICAL ALERT' : 'VERIFIED'}
                      </span>
                    </td>
                    <td title={item.timestamp} style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                      {formatUtcTimestamp(item.timestamp)}
                    </td>
                    <td>
                      <button className="details-link" onClick={() => setSelectedItem(item)}>
                        Inspect Record
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', flexWrap: 'wrap', gap: '10px' }}>
            <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
              Showing {((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length} recent audit entries (Total in MongoDB: {totals.scans !== null ? Number(totals.scans).toLocaleString() : filteredData.length})
            </span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                style={{
                  background: currentPage === 1 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.08)',
                  color: currentPage === 1 ? '#475569' : '#fff',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '6px',
                  padding: '6px 14px',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  fontSize: '0.8rem',
                }}
              >
                Previous
              </button>
              <span style={{ padding: '4px 10px', fontSize: '0.82rem', color: '#38bdf8', fontWeight: 600 }}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                style={{
                  background: currentPage >= totalPages ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.08)',
                  color: currentPage >= totalPages ? '#475569' : '#fff',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '6px',
                  padding: '6px 14px',
                  cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                  fontSize: '0.8rem',
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* View Details Popup */}
        {selectedItem && (
          <div className="modal-overlay" onClick={() => setSelectedItem(null)}>
            <div className="details-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Cryptographic Audit Details</h3>
                <button onClick={() => setSelectedItem(null)}>×</button>
              </div>
              <div className="modal-body">
                <p><strong>Device ID:</strong> {selectedItem.device} ({selectedItem.machine_name || selectedItem.device})</p>
                <p><strong>Status:</strong> <span className={`status-pill ${getStatusClass(selectedItem.status)}`}>{selectedItem.status.toUpperCase()}</span></p>
                <p><strong>Ledger Transaction Hash:</strong><br/><code style={{ wordBreak: 'break-all', color: '#38bdf8', background: 'rgba(56,189,248,0.1)', padding: '4px', borderRadius: '4px' }}>{selectedItem.hash}</code></p>
                <p><strong>Telemetry Metrics:</strong> Temp: {selectedItem.temp}°C | Vibration: {selectedItem.vib} mm/s | Power: {selectedItem.pwr} kW {selectedItem.pressure ? `| Pressure: ${selectedItem.pressure} bar` : ''}</p>
                <p><strong>AI Reconstruction Loss:</strong> <span style={{ color: selectedItem.loss > selectedItem.threshold ? '#ef4444' : '#22c55e', fontWeight: 600 }}>{selectedItem.loss !== undefined ? Number(selectedItem.loss).toFixed(6) : '—'}</span> (Threshold: {selectedItem.threshold !== undefined ? Number(selectedItem.threshold).toFixed(6) : '—'})</p>
                <p><strong>Dynamic AI Confidence:</strong> <span style={{ color: '#38bdf8', fontWeight: 600 }}>{selectedItem.confidence !== undefined ? `${Number(selectedItem.confidence).toFixed(1)}%` : '—'}</span> {selectedItem.severity ? `(Severity: ${selectedItem.severity})` : ''}</p>
                <p><strong>AI Inference Engine:</strong> {selectedItem.ai_source}</p>
                {selectedItem.description && <p><strong>Analysis:</strong> {selectedItem.description}</p>}
                <p><strong>Recommendation:</strong> {selectedItem.recommendation || 'Operational parameters nominal.'}</p>
                <p><strong>Local Timestamp:</strong> {formatUtcTimestamp(selectedItem.timestamp)}</p>
                <p><strong>ISO Timestamp (UTC):</strong> {selectedItem.timestamp}</p>
              </div>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
};

export default HistoryPage;