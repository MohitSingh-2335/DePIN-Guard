import { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import './DashboardPage.css';

const DashboardPage = () => {
  const [stats, setStats] = useState({
    activeDevices: 0,
    totalData: 0,
    alerts: 0,
    uptime: 100.0
  });

  const [recentData, setRecentData] = useState([]);
  const [timePeriod, setTimePeriod] = useState('24h');
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  // 🔒 SECURE FETCH FUNCTION
  const fetchStats = async () => {
    try {
      const response = await fetch('/api/dashboard', {
        headers: {
          // KEY MUST MATCH BACKEND .ENV
          'X-API-Key': 'Depin_Project_Secret_Key_999', 
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.error("Auth Error or Network Error");
        return;
      }
      
      const data = await response.json();
      
      setStats({
        activeDevices: data.stats.active,
        totalData: data.stats.scans,
        alerts: data.stats.anomalies,
        uptime: data.stats.uptime
      });
      
      setRecentData([...data.recent_data].reverse());
      setLoading(false);

    } catch (error) {
      console.error("Error fetching dashboard:", error);
    }
  };

  // ✅ FIXED: Using the correct function name 'fetchStats'
  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 2000);
    return () => clearInterval(interval);
  }, []);

  // Visual-only chart logic (Kept to preserve UI layout)
  const generateChartData = (period) => {
    let points = [];
    let numPoints;
    
    switch(period) {
      case '24h': numPoints = 24; break;
      case '7d': numPoints = 7; break;
      case '30d': numPoints = 30; break;
      default: numPoints = 24;
    }

    for (let i = 0; i < numPoints; i++) {
      points.push({
        x: i,
        y: Math.random() * 50 + 30,
        label: period === '24h' ? `${i}:00` : `Day ${i + 1}`
      });
    }
    return points;
  };

  useEffect(() => {
    setChartData(generateChartData(timePeriod));
  }, [timePeriod]);

  const handleRefresh = () => {
    fetchStats(); // ✅ FIXED: Correct function name
    setChartData(generateChartData(timePeriod));
  };

  const handleTimePeriodChange = (e) => {
    setTimePeriod(e.target.value);
  };

  const getStatusColor = (status) => {
    const s = status ? status.toLowerCase() : 'normal';
    switch(s) {
      case 'normal': return '#22c55e';
      case 'warning': return '#f59e0b';
      case 'critical': return '#ef4444';
      default: return '#6b7280';
    }
  };

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

          {recentData.length === 0 ? (
             <div style={{padding:'40px', textAlign:'center', color:'#666'}}>Waiting for Simulator Data...</div>
          ) : (
            <div className="data-grid">
              {recentData.map((data, index) => (
                <div key={index} className="data-card" style={{borderLeft: data.status === 'critical' ? '4px solid #ef4444' : 'none'}}>
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
                      {data.status.toUpperCase()}
                    </div>
                  </div>
                  
                  {/* REAL DATA DISPLAY */}
                  <div className="data-value-container" style={{display:'flex', flexDirection:'column', gap:'5px', marginTop:'10px'}}>
                    <div style={{display:'flex', justifyContent:'space-between'}}>
                        <span style={{fontSize:'12px', color:'#888'}}>Temp:</span>
                        <span style={{fontWeight:'bold'}}>{data.temp}°C</span>
                    </div>
                    <div style={{display:'flex', justifyContent:'space-between'}}>
                        <span style={{fontSize:'12px', color:'#888'}}>Vib:</span>
                        <span style={{fontWeight:'bold'}}>{data.vib} Hz</span>
                    </div>
                    <div style={{display:'flex', justifyContent:'space-between'}}>
                        <span style={{fontSize:'12px', color:'#888'}}>Power:</span>
                        <span style={{fontWeight:'bold', color:'#0ea5e9'}}>{data.pwr} W</span>
                    </div>
                  </div>

                  <div className="data-time">{data.timestamp}</div>
                </div>
              ))}
            </div>
          )}
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