import { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import './DashboardPage.css';

const DashboardPage = () => {
  const [stats, setStats] = useState({
    activeDevices: 24,
    totalData: 1543,
    alerts: 3,
    uptime: 99.9
  });

  const [recentData, setRecentData] = useState([
    { id: 1, device: 'Sensor-01', value: 23.5, unit: '°C', status: 'normal', time: '2 min ago' },
    { id: 2, device: 'Sensor-02', value: 65.2, unit: '%', status: 'normal', time: '3 min ago' },
    { id: 3, device: 'Sensor-03', value: 98.7, unit: 'kPa', status: 'warning', time: '5 min ago' },
    { id: 4, device: 'Sensor-04', value: 45.1, unit: '°C', status: 'critical', time: '7 min ago' },
  ]);

  const [timePeriod, setTimePeriod] = useState('24h');
  const [chartData, setChartData] = useState([]);

  // Generate chart data based on time period
  const generateChartData = (period) => {
    let points = [];
    let numPoints;
    
    switch(period) {
      case '24h':
        numPoints = 24;
        break;
      case '7d':
        numPoints = 7;
        break;
      case '30d':
        numPoints = 30;
        break;
      default:
        numPoints = 24;
    }

    for (let i = 0; i < numPoints; i++) {
      points.push({
        x: i,
        y: Math.random() * 50 + 30, // Random values between 30-80
        label: period === '24h' ? `${i}:00` : `Day ${i + 1}`
      });
    }
    
    return points;
  };

  // Initialize chart data
  useEffect(() => {
    setChartData(generateChartData(timePeriod));
  }, [timePeriod]);

  // Update stats every 5 seconds
  useEffect(() => {
    const statsInterval = setInterval(() => {
      setStats(prevStats => ({
        activeDevices: prevStats.activeDevices + Math.floor(Math.random() * 3) - 1,
        totalData: prevStats.totalData + Math.floor(Math.random() * 10),
        alerts: Math.max(0, prevStats.alerts + Math.floor(Math.random() * 3) - 1),
        uptime: Math.min(100, Math.max(98, prevStats.uptime + (Math.random() * 0.2 - 0.1)))
      }));
    }, 5000);

    return () => clearInterval(statsInterval);
  }, []);

  // Update sensor data every 3 seconds
  useEffect(() => {
    const dataInterval = setInterval(() => {
      setRecentData(prevData => 
        prevData.map(item => {
          const newValue = parseFloat((item.value + (Math.random() * 4 - 2)).toFixed(1));
          let newStatus = 'normal';
          
          if (item.unit === '°C') {
            if (newValue > 40) newStatus = 'critical';
            else if (newValue > 30) newStatus = 'warning';
          } else if (item.unit === '%') {
            if (newValue > 80) newStatus = 'warning';
            else if (newValue > 90) newStatus = 'critical';
          } else if (item.unit === 'kPa') {
            if (newValue > 100) newStatus = 'critical';
            else if (newValue > 95) newStatus = 'warning';
          }

          return {
            ...item,
            value: newValue,
            status: newStatus,
            time: 'Just now'
          };
        })
      );
    }, 3000);

    return () => clearInterval(dataInterval);
  }, []);

  // Update chart data periodically
  useEffect(() => {
    const chartInterval = setInterval(() => {
      setChartData(prevData => {
        const newData = [...prevData];
        // Shift data and add new point
        newData.shift();
        newData.push({
          x: prevData[prevData.length - 1].x + 1,
          y: Math.random() * 50 + 30,
          label: timePeriod === '24h' ? 
            `${new Date().getHours()}:${new Date().getMinutes()}` : 
            `Point ${prevData[prevData.length - 1].x + 1}`
        });
        return newData;
      });
    }, 10000); // Update every 10 seconds

    return () => clearInterval(chartInterval);
  }, [timePeriod]);

  const handleRefresh = () => {
    setChartData(generateChartData(timePeriod));
    setStats(prev => ({...prev, totalData: prev.totalData + 1}));
  };

  const handleTimePeriodChange = (e) => {
    setTimePeriod(e.target.value);
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'normal': return '#22c55e';
      case 'warning': return '#f59e0b';
      case 'critical': return '#ef4444';
      default: return '#6b7280';
    }
  };

  // Convert chart data to SVG points
  const getChartPoints = () => {
    if (chartData.length === 0) return '';
    
    const width = 200;
    const height = 100;
    const maxY = Math.max(...chartData.map(d => d.y));
    const minY = Math.min(...chartData.map(d => d.y));
    const range = maxY - minY || 1;
    
    return chartData.map((point, index) => {
      const x = (index / (chartData.length - 1)) * width;
      const y = height - ((point.y - minY) / range) * (height - 20) - 10;
      return `${x},${y}`;
    }).join(' ');
  };

  return (
    <Layout>
      <div className="dashboard-container">
        {/* Page Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">Real-time monitoring of your IoT devices</p>
          </div>
          <button className="refresh-button" onClick={handleRefresh}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.activeDevices}</div>
              <div className="stat-label">Active Devices</div>
            </div>
            <div className="stat-trend positive">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
              </svg>
              <span>+12%</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.totalData.toLocaleString()}</div>
              <div className="stat-label">Total Records</div>
            </div>
            <div className="stat-trend positive">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
              </svg>
              <span>+8%</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.alerts}</div>
              <div className="stat-label">Active Alerts</div>
            </div>
            <div className="stat-trend negative">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12 13a1 1 0 100 2h5a1 1 0 001-1V9a1 1 0 10-2 0v2.586l-4.293-4.293a1 1 0 00-1.414 0L8 9.586 3.707 5.293a1 1 0 00-1.414 1.414l5 5a1 1 0 001.414 0L11 9.414 14.586 13H12z" clipRule="evenodd" />
              </svg>
              <span>-5%</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.uptime.toFixed(1)}%</div>
              <div className="stat-label">System Uptime</div>
            </div>
            <div className="stat-trend positive">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
              </svg>
              <span>+0.2%</span>
            </div>
          </div>
        </div>

        {/* Recent Data */}
        <div className="data-section">
          <div className="section-header">
            <h2 className="section-title">Recent Device Data</h2>
            <button className="view-all-button">View All →</button>
          </div>

          <div className="data-grid">
            {recentData.map((data) => (
              <div key={data.id} className="data-card">
                <div className="data-header">
                  <div className="device-info">
                    <div className="device-icon">
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"/>
                      </svg>
                    </div>
                    <div className="device-name">{data.device}</div>
                  </div>
                  <div className="status-badge" style={{ background: getStatusColor(data.status) + '20', color: getStatusColor(data.status) }}>
                    {data.status}
                  </div>
                </div>
                <div className="data-value-container">
                  <div className="data-value">{data.value}</div>
                  <div className="data-unit">{data.unit}</div>
                </div>
                <div className="data-time">{data.time}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Chart Section */}
        <div className="chart-section">
          <div className="section-header">
            <h2 className="section-title">Device Activity</h2>
            <select className="time-select" value={timePeriod} onChange={handleTimePeriodChange}>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>
          <div className="chart-placeholder">
            <svg viewBox="0 0 200 100" className="mock-chart">
              <polyline
                fill="none"
                stroke="url(#gradient)"
                strokeWidth="2"
                points={getChartPoints()}
              />
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#0ea5e9" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </svg>
            <div className="chart-label">
              {timePeriod === '24h' && 'Device activity over last 24 hours'}
              {timePeriod === '7d' && 'Device activity over last 7 days'}
              {timePeriod === '30d' && 'Device activity over last 30 days'}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default DashboardPage;