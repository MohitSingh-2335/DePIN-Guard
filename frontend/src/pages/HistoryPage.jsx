import { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import './HistoryPage.css';

const HistoryPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  
  const [historyData, setHistoryData] = useState([]);

  // 🔒 SECURE FETCH FUNCTION
  const fetchHistory = async () => {
    try {
      // 2. Fetch with Secret Key
      const response = await fetch('/api/history', {
        headers: {
          'X-API-Key': 'my-secret-depin-key-123', // <--- MUST MATCH PYTHON BACKEND
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) return;
      
      const data = await response.json();
      
      // Backend returns the full list sorted by newest first
      setHistoryData(data);

    } catch (error) {
      console.error("History Error:", error);
    }
  };

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 5000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status) => {
    const s = status ? status.toLowerCase() : 'unknown';
    switch(s) {
      case 'verified': return { bg: '#22c55e20', text: '#22c55e' };
      case 'confirmed': return { bg: '#22c55e20', text: '#22c55e' };
      case 'normal': return { bg: '#22c55e20', text: '#22c55e' };
      case 'pending': return { bg: '#f59e0b20', text: '#f59e0b' };
      case 'failed': return { bg: '#ef444420', text: '#ef4444' };
      case 'critical': return { bg: '#ef444420', text: '#ef4444' };
      default: return { bg: '#6b728020', text: '#6b7280' };
    }
  };

  const filteredData = historyData.filter(item => {
    const matchesSearch = (item.device && item.device.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (item.hash && item.hash.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Map backend status to filter categories
    const matchesFilter = filterStatus === 'all' || (item.status && item.status.toLowerCase() === filterStatus);
    return matchesSearch && matchesFilter;
  });

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = filteredData.slice(startIndex, endIndex);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, searchTerm]);

  const handleExportCSV = () => {
    const headers = ['ID', 'Device', 'Hash', 'Value', 'Timestamp', 'Status'];
    const csvData = filteredData.map(item => [
      item.id,
      item.device,
      item.hash,
      item.value,
      item.timestamp,
      item.status
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `iot-history-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  return (
    <Layout>
      <div className="history-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">Data History</h1>
            <p className="page-subtitle">View all blockchain-verified device data</p>
          </div>
          <button className="export-button" onClick={handleExportCSV}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </button>
        </div>

        <div className="filters-section">
          <div className="search-box">
            <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by device or hash..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="filter-buttons">
            <button 
              className={`filter-btn ${filterStatus === 'all' ? 'active' : ''}`}
              onClick={() => setFilterStatus('all')}
            >
              All ({historyData.length})
            </button>
            <button 
              className={`filter-btn ${filterStatus === 'critical' ? 'active' : ''}`}
              onClick={() => setFilterStatus('critical')}
            >
              Critical ({historyData.filter(i => i.status === 'critical').length})
            </button>
            <button 
              className={`filter-btn ${filterStatus === 'normal' ? 'active' : ''}`}
              onClick={() => setFilterStatus('normal')}
            >
              Normal ({historyData.filter(i => i.status === 'normal').length})
            </button>
          </div>
        </div>

        <div className="table-container">
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Device</th>
                  <th>Hash</th>
                  <th>Value</th>
                  <th>Timestamp</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {currentData.length === 0 ? (
                    <tr>
                        <td colSpan="7" style={{textAlign:'center', padding:'30px', color:'#666'}}>
                            No logs found in system memory.
                        </td>
                    </tr>
                ) : (
                    currentData.map((item) => (
                    <tr key={item.id}>
                        <td data-label="ID">#{String(item.id).slice(-4)}</td>
                        <td data-label="Device">
                        <div className="device-cell">
                            <div className="device-icon-small">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"/>
                            </svg>
                            </div>
                            <span>{item.device}</span>
                        </div>
                        </td>
                        <td data-label="Hash">
                        <code className="hash-code">
                            {item.hash && item.hash !== '---' ? item.hash.substring(0, 10) + '...' : '---'}
                        </code>
                        </td>
                        <td data-label="Value">
                        <span className="value-badge">{item.value}</span>
                        </td>
                        <td data-label="Timestamp">{item.timestamp}</td>
                        <td data-label="Status">
                        <span 
                            className="status-badge-table"
                            style={{ 
                            background: getStatusColor(item.status).bg,
                            color: getStatusColor(item.status).text
                            }}
                        >
                            {item.status ? item.status.toUpperCase() : 'UNKNOWN'}
                        </span>
                        </td>
                        <td data-label="Action">
                        <button className="action-button" title="View Details">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                        </button>
                        </td>
                    </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {filteredData.length > 0 && (
          <div className="pagination">
            <button 
              className="pagination-button"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Previous
            </button>
            <div className="page-numbers">
              <span className="page-number active">{currentPage}</span>
            </div>
            <button 
              className="pagination-button"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default HistoryPage;