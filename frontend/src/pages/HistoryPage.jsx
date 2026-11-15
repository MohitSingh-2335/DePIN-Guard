import { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import { authenticatedFetch } from '../utils/api';
import './HistoryPage.css';

// --- Helper: Time Formatting ---
const formatTime = (timestamp) => {
  if (!timestamp) return '---';
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return String(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return date.toLocaleString();
  } catch {
    return String(timestamp);
  }
};

const HistoryPage = () => {
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [searchTerm, setSearchTerm]   = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState(null);
  const itemsPerPage = 12;

  const fetchHistory = async () => {
    try {
      const res = await authenticatedFetch('/api/history/all');
      if (res?.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.history)) {
          setHistoryData(data.history);
        }
      }
    } catch (error) {
      console.error('[History] Fetch failed:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 4000);
    return () => clearInterval(interval);
  }, []);

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
    const headers = ['ID', 'Device', 'Hash', 'Status', 'Temperature', 'Vibration', 'Power', 'Timestamp'];
    const csvRows = filteredData.map(h => 
      `"${h.id}","${h.device}","${h.hash}","${h.status}",${h.temp},${h.vib},${h.pwr},"${h.timestamp}"`
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
            <p className="page-subtitle">Cryptographic ledger and sensor telemetry history verified across consortium nodes</p>
          </div>
          <button className="export-button" onClick={handleExportCSV}>
            Export Audit CSV
          </button>
        </div>

        {/* Mini Stats Grid */}
        <div className="history-stats-grid">
          <div className="stat-card">
            <span className="stat-label">Total Verified Records</span>
            <span className="stat-value">{historyData.length}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Critical Anomaly Logs</span>
            <span className="stat-value text-danger">
              {historyData.filter(h => h.status === 'critical' || h.anomaly === 1).length}
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Optimal Machine Scans</span>
            <span className="stat-value text-success">
              {historyData.filter(h => h.status === 'verified' || h.status === 'normal').length}
            </span>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="controls-section">
          <div className="search-wrapper">
            <input 
              type="text" 
              placeholder="Search by Node ID, Hash, or Mongo ID..." 
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
              <option value="all">All Telemetry Logs</option>
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
                        {item.hash ? `${item.hash.slice(0, 14)}...` : item.id.slice(-8)}
                      </code>
                    </td>
                    <td><strong className="node-code">{item.device}</strong></td>
                    <td style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                      {item.temp}°C · {item.vib} mm/s · {item.pwr}W
                    </td>
                    <td>
                      <span className={`status-pill ${getStatusClass(item.status)}`}>
                        {item.status === 'critical' ? 'CRITICAL ALERT' : 'VERIFIED'}
                      </span>
                    </td>
                    <td title={item.timestamp} style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                      {formatTime(item.timestamp)}
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
              Showing {((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length} audit entries
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
                <p><strong>Device ID:</strong> {selectedItem.device}</p>
                <p><strong>Status:</strong> <span className={`status-pill ${getStatusClass(selectedItem.status)}`}>{selectedItem.status.toUpperCase()}</span></p>
                <p><strong>Ledger Transaction Hash:</strong><br/><code style={{ wordBreak: 'break-all', color: '#38bdf8', background: 'rgba(56,189,248,0.1)', padding: '4px', borderRadius: '4px' }}>{selectedItem.hash}</code></p>
                <p><strong>Telemetry Metrics:</strong> Temp: {selectedItem.temp}°C | Vibration: {selectedItem.vib} mm/s | Power: {selectedItem.pwr} W {selectedItem.pressure ? `| Pressure: ${selectedItem.pressure} bar` : ''}</p>
                <p><strong>AI Inference Engine:</strong> {selectedItem.ai_source}</p>
                <p><strong>Recommendation:</strong> {selectedItem.recommendation || 'Operational parameters nominal.'}</p>
                <p><strong>Full Timestamp:</strong> {selectedItem.timestamp}</p>
              </div>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
};

export default HistoryPage;