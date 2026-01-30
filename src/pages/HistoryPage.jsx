import { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import './HistoryPage.css';

const HistoryPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  
  const [historyData, setHistoryData] = useState([
    { id: 1, device: 'Sensor-01', hash: '0x7a8f3e2d', timestamp: new Date(Date.now() - 5 * 60000).toLocaleString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\//g, '-'), status: 'verified', value: '23.5°C' },
    { id: 2, device: 'Sensor-02', hash: '0x9b4c7f1a', timestamp: new Date(Date.now() - 7 * 60000).toLocaleString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\//g, '-'), status: 'verified', value: '65.2%' },
    { id: 3, device: 'Sensor-03', hash: '0x2d6e4b8c', timestamp: new Date(Date.now() - 10 * 60000).toLocaleString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\//g, '-'), status: 'pending', value: '98.7 kPa' },
    { id: 4, device: 'Sensor-04', hash: '0x5c1a9e3f', timestamp: new Date(Date.now() - 12 * 60000).toLocaleString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\//g, '-'), status: 'verified', value: '45.1°C' },
    { id: 5, device: 'Sensor-01', hash: '0x8e7d2a4b', timestamp: new Date(Date.now() - 15 * 60000).toLocaleString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\//g, '-'), status: 'verified', value: '22.8°C' },
    { id: 6, device: 'Sensor-02', hash: '0x3f9b6c5d', timestamp: new Date(Date.now() - 18 * 60000).toLocaleString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\//g, '-'), status: 'verified', value: '64.9%' },
    { id: 7, device: 'Sensor-03', hash: '0x4a2c8e1f', timestamp: new Date(Date.now() - 20 * 60000).toLocaleString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\//g, '-'), status: 'failed', value: '97.3 kPa' },
    { id: 8, device: 'Sensor-04', hash: '0x6d8f3b7a', timestamp: new Date(Date.now() - 23 * 60000).toLocaleString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\//g, '-'), status: 'verified', value: '44.5°C' },
  ]);

  const devices = ['Sensor-01', 'Sensor-02', 'Sensor-03', 'Sensor-04', 'Sensor-05'];
  const units = ['°C', '%', 'kPa'];
  const statuses = ['verified', 'pending', 'failed'];

  // Generate random hash
  const generateHash = () => {
    const chars = '0123456789abcdef';
    let hash = '0x';
    for (let i = 0; i < 8; i++) {
      hash += chars[Math.floor(Math.random() * chars.length)];
    }
    return hash;
  };

  // Generate random sensor value
  const generateValue = (unit) => {
    let value;
    if (unit === '°C') value = (Math.random() * 30 + 20).toFixed(1);
    else if (unit === '%') value = (Math.random() * 40 + 50).toFixed(1);
    else value = (Math.random() * 20 + 85).toFixed(1);
    return value + unit;
  };

  // Add new data entry every 6 seconds
  useEffect(() => {
    const dataInterval = setInterval(() => {
      const device = devices[Math.floor(Math.random() * devices.length)];
      const unit = units[Math.floor(Math.random() * units.length)];
      const status = Math.random() < 0.7 ? 'verified' : (Math.random() < 0.8 ? 'pending' : 'failed');
      
      const newEntry = {
        id: Date.now(),
        device,
        hash: generateHash(),
        timestamp: new Date().toLocaleString('en-GB', { 
          year: 'numeric', 
          month: '2-digit', 
          day: '2-digit', 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit' 
        }).replace(/\//g, '-'),
        status,
        value: generateValue(unit)
      };

      setHistoryData(prev => [newEntry, ...prev].slice(0, 100)); // Keep last 100 entries
    }, 6000); // New entry every 6 seconds

    return () => clearInterval(dataInterval);
  }, []);

  // Update pending statuses to verified after some time
  useEffect(() => {
    const statusUpdateInterval = setInterval(() => {
      setHistoryData(prev => prev.map(item => {
        if (item.status === 'pending' && Math.random() < 0.3) {
          return { ...item, status: 'verified' };
        }
        return item;
      }));
    }, 5000);

    return () => clearInterval(statusUpdateInterval);
  }, []);

  const getStatusColor = (status) => {
    switch(status) {
      case 'verified': return { bg: '#22c55e20', text: '#22c55e' };
      case 'pending': return { bg: '#f59e0b20', text: '#f59e0b' };
      case 'failed': return { bg: '#ef444420', text: '#ef4444' };
      default: return { bg: '#6b728020', text: '#6b7280' };
    }
  };

  const filteredData = historyData.filter(item => {
    const matchesSearch = item.device.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.hash.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || item.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  // Pagination
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = filteredData.slice(startIndex, endIndex);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, searchTerm]);

  // Export to CSV
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
        {/* Page Header */}
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

        {/* Filters */}
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
              className={`filter-btn ${filterStatus === 'verified' ? 'active' : ''}`}
              onClick={() => setFilterStatus('verified')}
            >
              Verified ({historyData.filter(i => i.status === 'verified').length})
            </button>
            <button 
              className={`filter-btn ${filterStatus === 'pending' ? 'active' : ''}`}
              onClick={() => setFilterStatus('pending')}
            >
              Pending ({historyData.filter(i => i.status === 'pending').length})
            </button>
            <button 
              className={`filter-btn ${filterStatus === 'failed' ? 'active' : ''}`}
              onClick={() => setFilterStatus('failed')}
            >
              Failed ({historyData.filter(i => i.status === 'failed').length})
            </button>
          </div>
        </div>

        {/* Data Table */}
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
                {currentData.map((item) => (
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
                      <code className="hash-code">{item.hash}</code>
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
                        {item.status}
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
                ))}
              </tbody>
            </table>
          </div>

          {filteredData.length === 0 && (
            <div className="no-data">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p>No data found</p>
            </div>
          )}
        </div>

        {/* Pagination */}
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
              {[...Array(Math.min(5, totalPages))].map((_, index) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = index + 1;
                } else if (currentPage <= 3) {
                  pageNum = index + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + index;
                } else {
                  pageNum = currentPage - 2 + index;
                }
                
                return (
                  <button
                    key={pageNum}
                    className={`page-number ${currentPage === pageNum ? 'active' : ''}`}
                    onClick={() => handlePageChange(pageNum)}
                  >
                    {pageNum}
                  </button>
                );
              })}
              {totalPages > 5 && currentPage < totalPages - 2 && (
                <>
                  <span className="page-dots">...</span>
                  <button
                    className="page-number"
                    onClick={() => handlePageChange(totalPages)}
                  >
                    {totalPages}
                  </button>
                </>
              )}
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

        {/* Results Info */}
        {filteredData.length > 0 && (
          <div className="results-info">
            Showing {startIndex + 1} to {Math.min(endIndex, filteredData.length)} of {filteredData.length} entries
          </div>
        )}
      </div>
    </Layout>
  );
};

export default HistoryPage;