import { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import { authenticatedFetch } from '../utils/api';
import './HistoryPage.css';

// --- Helper: Time Formatting (Point #6) ---
const formatTime = (timestamp) => {
  if (!timestamp) return '---';
  const date = new Date(timestamp);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return date.toLocaleDateString();
};

const HistoryPage = () => {
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState(null); // (Point #5: Popup State)
  const itemsPerPage = 10;

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
    const interval = setInterval(fetchHistory, 5000);
    return () => clearInterval(interval);
  }, []);

  // --- Color Coding Logic (Point #2) ---
  const getStatusClass = (status) => {
    const s = status?.toLowerCase();
    if (s === 'verified' || s === 'normal') return 'status-success';
    if (s === 'critical' || s === 'failed') return 'status-danger';
    if (s === 'pending') return 'status-warning';
    return 'status-info';
  };

  // --- Filter & Search Logic (Point #3 & #4) ---
  const filteredData = historyData.filter(item => {
    const matchesSearch = 
      (item.device ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.hash ?? '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || item.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  // --- Pagination Logic (Point #8) ---
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const currentData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // --- Export CSV (Point #10) ---
  const handleExportCSV = () => {
    const headers = ['ID', 'Device', 'Hash', 'Status', 'Timestamp'];
    const csvRows = filteredData.map(h => `${h.id},${h.device},${h.hash},${h.status},${h.timestamp}`);
    const blob = new Blob([[headers.join(','), ...csvRows].join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().getTime()}.csv`;
    a.click();
  };

  return (
    <Layout>
      <div className="history-container">
        
        {/* Header & Export (Point #10) */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Network Audit Logs</h1>
            <p className="page-subtitle">Real-time history of DePIN node activities</p>
          </div>
          <button className="export-button" onClick={handleExportCSV}>
            Export CSV
          </button>
        </div>

        {/* Mini Stats Grid */}
        <div className="history-stats-grid">
          <div className="stat-card">
            <span className="stat-label">Total Logs</span>
            <span className="stat-value">{historyData.length}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Critical Alerts</span>
            <span className="stat-value text-danger">
              {historyData.filter(h => h.status === 'critical').length}
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Verified Nodes</span>
            <span className="stat-value text-success">
              {historyData.filter(h => h.status === 'verified').length}
            </span>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="controls-section">
          <div className="search-wrapper">
            <input 
              type="text" 
              placeholder="Search by Node ID or Hash..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          <div className="filter-wrapper">
            <select 
              value={filterStatus} 
              onChange={(e) => setFilterStatus(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Events</option>
              <option value="verified">Verified Only</option>
              <option value="critical">Critical Only</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>

        {/* Activity Table */}
        <div className="table-container">
          {loading ? (
            <div className="loader">Syncing with Ledger...</div>
          ) : filteredData.length === 0 ? (
            <div className="empty-state">No activity logs found.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Event ID</th>
                  <th>Node ID</th>
                  <th>Status</th>
                  <th>Time</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {currentData.map((item) => (
                  <tr key={item.id}>
                    <td><span className="id-badge">#{item.id}</span></td>
                    <td><code className="node-code">{item.device}</code></td>
                    <td>
                      <span className={`status-pill ${getStatusClass(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                    <td title={item.timestamp}>{formatTime(item.timestamp)}</td>
                    <td>
                      <button className="details-link" onClick={() => setSelectedItem(item)}>
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* View Details Popup */}
        {selectedItem && (
          <div className="modal-overlay" onClick={() => setSelectedItem(null)}>
            <div className="details-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Log Details</h3>
                <button onClick={() => setSelectedItem(null)}>×</button>
              </div>
              <div className="modal-body">
                <p><strong>Device ID:</strong> {selectedItem.device}</p>
                <p><strong>Blockchain Hash:</strong> <br/><small>{selectedItem.hash}</small></p>
                <p><strong>Metrics:</strong> {selectedItem.temp}°C | {selectedItem.pwr}W</p>
                <p><strong>Status:</strong> {selectedItem.status.toUpperCase()}</p>
                <p><strong>Full Timestamp:</strong> {selectedItem.timestamp}</p>
              </div>
            </div>
          </div>
        )}

        {/* Pagination logic here (similar to your original code) */}
      </div>
    </Layout>
  );
};

export default HistoryPage;