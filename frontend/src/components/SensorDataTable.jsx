import React, { useState } from 'react';
import './SensorDataTable.css';

/**
 * SensorDataTable Component
 * Displays sensor readings in a professional table format
 * Supports real-time updates with scrollable list
 */
export const SensorDataTable = ({ data = [], title = 'Sensor Readings', isLoading = false }) => {
  const [sortBy, setSortBy] = useState('timestamp');
  const [sortOrder, setSortOrder] = useState('desc');

  // Sort data
  const sortedData = [...data].sort((a, b) => {
    let aVal = a[sortBy] ?? '';
    let bVal = b[sortBy] ?? '';
    
    if (sortBy === 'value' || sortBy === 'timestamp') {
      aVal = typeof aVal === 'string' ? parseFloat(aVal) : aVal;
      bVal = typeof bVal === 'string' ? parseFloat(bVal) : bVal;
    }
    
    return sortOrder === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
  });

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'normal': return '[OK]';
      case 'warning': return '[WARN]';
      case 'critical': return '[ALERT]';
      default: return '[UNK]';
    }
  };

  return (
    <div className="sensor-table-wrapper">
      <div className="sensor-table-header">
        <h3 className="sensor-table-title">{title}</h3>
        <span className="sensor-count-badge">{data.length} records</span>
      </div>

      {isLoading && data.length === 0 ? (
        <div className="sensor-table-empty">
          <div className="spinner-small"></div>
          <p>Loading sensor data...</p>
        </div>
      ) : data.length === 0 ? (
        <div className="sensor-table-empty">
          <p>No sensor data available</p>
        </div>
      ) : (
        <div className="sensor-table-container">
          <table className="sensor-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('device')} className="sortable">
                  Device {sortBy === 'device' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('value')} className="sortable">
                  Value {sortBy === 'value' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('status')} className="sortable">
                  Status {sortBy === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('timestamp')} className="sortable">
                  Time {sortBy === 'timestamp' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map((reading, idx) => (
                <tr key={reading.id || idx} className={`status-${reading.status}`}>
                  <td className="device-cell">
                    <code className="device-id">{reading.device}</code>
                  </td>
                  <td className="value-cell">
                    <span className="value-number">{reading.value ?? 'N/A'}</span>
                    <span className="value-unit">{reading.unit}</span>
                  </td>
                  <td className="status-cell">
                    <span className={`status-badge status-${reading.status}`}>
                      {getStatusIcon(reading.status)} {reading.status}
                    </span>
                  </td>
                  <td className="time-cell">
                    <span className="timestamp">{reading.time}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SensorDataTable;
