import React, { useState, useEffect } from 'react';
import IoTAlertCard from './IoTAlertCard';
import Layout from './layout/Layout';
import { authenticatedFetch } from '../utils/api';
import './IoTDashboardView.css';

/**
 * IoTDashboardView - Professional display of all active IoT devices
 * Shows real-time status with human-readable formatting
 */
const IoTDashboardView = () => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'normal', 'warning', 'critical'
  const [sortBy, setSortBy] = useState('alert'); // 'alert', 'name', 'time'

  // Fetch live device data
  const fetchDevices = async () => {
    try {
      const response = await authenticatedFetch('/api/dashboard');
      if (response && response.ok) {
        const data = await response.json();
        
        // Transform data for display
        const deviceList = (data.recent_data || []).map(item => ({
          device_id: item.device_id || item.device || 'Unknown',
          machine_name: item.machine_name || 'Device',
          alert_level: item.alert_level || 'normal',
          status_short: item.status_short || 'Running normally',
          temperature: item.temperature || item.temp || 0,
          vibration: item.vibration || item.vib || 0,
          power_usage: item.power_usage || item.power || 0,
          recommendations: item.recommendations || [],
          timestamp: item.timestamp || new Date().toISOString(),
        }));

        setDevices(deviceList);
      }
    } catch (error) {
      console.error('Failed to fetch device data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  // Apply filters
  const filteredDevices = devices.filter(device => {
    if (filter === 'all') return true;
    return device.alert_level === filter;
  });

  // Apply sorting
  const sortedDevices = [...filteredDevices].sort((a, b) => {
    switch (sortBy) {
      case 'alert':
        const alertOrder = { critical: 0, warning: 1, normal: 2 };
        return (alertOrder[a.alert_level] || 3) - (alertOrder[b.alert_level] || 3);
      case 'name':
        return a.machine_name.localeCompare(b.machine_name);
      case 'time':
        return new Date(b.timestamp) - new Date(a.timestamp);
      default:
        return 0;
    }
  });

  // Count by alert level
  const alertCounts = {
    critical: devices.filter(d => d.alert_level === 'critical').length,
    warning: devices.filter(d => d.alert_level === 'warning').length,
    normal: devices.filter(d => d.alert_level === 'normal').length,
  };

  return (
    <Layout>
      <div className="iot-dashboard-view">
        {/* Header */}
        <div className="iot-view-header">
          <div className="iot-view-title-section">
            <h1 className="iot-view-title">IoT Device Monitor</h1>
            <p className="iot-view-subtitle">Real-time status of all connected devices</p>
          </div>
          <button 
            className="iot-refresh-button" 
            onClick={fetchDevices}
            disabled={loading}
          >
            {loading ? 'Updating...' : 'Refresh'}
          </button>
        </div>

        {/* Statistics Cards */}
        <div className="iot-stats-container">
          <div className="iot-stat-card iot-stat-total">
            <div className="iot-stat-value">{devices.length}</div>
            <div className="iot-stat-label">Total Devices</div>
          </div>

          <div className="iot-stat-card iot-stat-normal">
            <div className="iot-stat-value">{alertCounts.normal}</div>
            <div className="iot-stat-label">Normal</div>
          </div>

          <div className="iot-stat-card iot-stat-warning">
            <div className="iot-stat-value">{alertCounts.warning}</div>
            <div className="iot-stat-label">Warnings</div>
          </div>

          <div className="iot-stat-card iot-stat-critical">
            <div className="iot-stat-value">{alertCounts.critical}</div>
            <div className="iot-stat-label">Critical</div>
          </div>
        </div>

        {/* Filters and Sort */}
        <div className="iot-controls">
          <div className="iot-filter-group">
            <label className="iot-control-label">Filter by Status:</label>
            <div className="iot-button-group">
              {['all', 'normal', 'warning', 'critical'].map(status => (
                <button
                  key={status}
                  className={`iot-filter-button ${filter === status ? 'active' : ''}`}
                  onClick={() => setFilter(status)}
                >
                  {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="iot-sort-group">
            <label className="iot-control-label">Sort by:</label>
            <select 
              className="iot-sort-select" 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="alert">Alert Level (Critical First)</option>
              <option value="name">Machine Name</option>
              <option value="time">Last Updated</option>
            </select>
          </div>
        </div>

        {/* Device Cards */}
        <div className="iot-devices-container">
          {loading ? (
            <div className="iot-loading">
              <p>Loading device data...</p>
            </div>
          ) : sortedDevices.length === 0 ? (
            <div className="iot-empty-state">
              <p>No devices found</p>
            </div>
          ) : (
            <div className="iot-devices-grid">
              {sortedDevices.map((device) => (
                <IoTAlertCard
                  key={device.device_id}
                  {...device}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default IoTDashboardView;
