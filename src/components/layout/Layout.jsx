import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Footer from './Footer';
import './Layout.css';

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  const location = useLocation();
  const navigate = useNavigate();
  const notifRef = useRef(null);
  const profileRef = useRef(null);
  const searchRef = useRef(null);

  const [notifications, setNotifications] = useState([
    { id: 1, type: 'warning', title: 'High Temperature Alert', message: 'Sensor-01 reading 45.1°C', time: '2 min ago', read: false },
    { id: 2, type: 'success', title: 'Block Verified', message: 'Block #12543 successfully verified', time: '5 min ago', read: false },
    { id: 3, type: 'info', title: 'New Device Connected', message: 'Sensor-05 is now online', time: '10 min ago', read: true },
    { id: 4, type: 'error', title: 'Connection Failed', message: 'Unable to reach Sensor-03', time: '15 min ago', read: false },
    { id: 5, type: 'success', title: 'AI Analysis Complete', message: 'Pattern recognition completed', time: '20 min ago', read: true },
  ]);

  const navItems = [
    { path: '/dashboard', icon: '📊', label: 'Dashboard', description: 'Overview & Stats' },
    { path: '/blockchain', icon: '🔗', label: 'Blockchain', description: 'Explorer & Verification' },
    { path: '/ai-analysis', icon: '🤖', label: 'AI Analysis', description: 'Anomaly Detection' },
    { path: '/history', icon: '📜', label: 'History', description: 'Data Records' },
    { path: '/settings', icon: '⚙️', label: 'Settings', description: 'Preferences' },
  ];

  // Get breadcrumbs from current path
  const getBreadcrumbs = () => {
    const paths = location.pathname.split('/').filter(Boolean);
    return paths.map((path, index) => ({
      label: path.charAt(0).toUpperCase() + path.slice(1).replace('-', ' '),
      path: '/' + paths.slice(0, index + 1).join('/')
    }));
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setNotificationsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setSearchOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Add new notification every 30 seconds
  useEffect(() => {
    const notifInterval = setInterval(() => {
      const types = ['info', 'warning', 'success', 'error'];
      const titles = {
        info: ['Device Update', 'System Info', 'New Feature'],
        warning: ['Temperature Warning', 'Low Battery', 'Memory Alert'],
        success: ['Task Complete', 'Backup Success', 'Update Installed'],
        error: ['Connection Lost', 'Sensor Failure', 'Error Detected']
      };
      const messages = {
        info: ['System updated successfully', 'New device detected', 'Cache cleared'],
        warning: ['Temperature rising above threshold', 'Battery below 20%', 'Memory usage high'],
        success: ['All systems operational', 'Data synced', 'Configuration saved'],
        error: ['Network timeout', 'Sensor not responding', 'Failed to authenticate']
      };

      const type = types[Math.floor(Math.random() * types.length)];
      const titleList = titles[type];
      const messageList = messages[type];

      const newNotif = {
        id: Date.now(),
        type,
        title: titleList[Math.floor(Math.random() * titleList.length)],
        message: messageList[Math.floor(Math.random() * messageList.length)],
        time: 'Just now',
        read: false
      };

      setNotifications(prev => [newNotif, ...prev].slice(0, 10));
    }, 30000); // Every 30 seconds

    return () => clearInterval(notifInterval);
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      localStorage.removeItem('isAuthenticated');
      navigate('/login');
    }
  };

  const markAsRead = (id) => {
    setNotifications(prev => 
      prev.map(notif => notif.id === id ? { ...notif, read: true } : notif)
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(notif => ({ ...notif, read: true })));
  };

  const clearNotifications = () => {
    setNotifications([]);
    setNotificationsOpen(false);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      console.log('Searching for:', searchQuery);
      // Implement search functionality
      alert(`Searching for: ${searchQuery}`);
      setSearchQuery('');
      setSearchOpen(false);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const getNotificationIcon = (type) => {
    switch(type) {
      case 'success': return '✓';
      case 'warning': return '⚠️';
      case 'error': return '✕';
      default: return 'ℹ️';
    }
  };

  const getNotificationColor = (type) => {
    switch(type) {
      case 'success': return '#22c55e';
      case 'warning': return '#f59e0b';
      case 'error': return '#ef4444';
      default: return '#0ea5e9';
    }
  };

  return (
    <div className="layout">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <button className="menu-toggle" onClick={toggleSidebar}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="header-logo">
            <svg className="logo-icon" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="logo-text">IoT Dashboard</span>
          </div>

          {/* Breadcrumbs */}
          <div className="breadcrumbs">
            <Link to="/dashboard" className="breadcrumb-item">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
              </svg>
            </Link>
            {getBreadcrumbs().map((crumb, index) => (
              <div key={index} className="breadcrumb-item-wrapper">
                <span className="breadcrumb-separator">/</span>
                <Link to={crumb.path} className="breadcrumb-item">
                  {crumb.label}
                </Link>
              </div>
            ))}
          </div>
        </div>
        
        <div className="header-right">
          {/* Online Status */}
          <div className={`status-indicator ${isOnline ? 'online' : 'offline'}`}>
            <span className="status-dot"></span>
            <span className="status-text">{isOnline ? 'Online' : 'Offline'}</span>
          </div>

          {/* Search Button */}
          <button className="header-button" onClick={() => setSearchOpen(!searchOpen)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>

          {/* Theme Toggle */}
          <button className="header-button" onClick={toggleTheme}>
            {theme === 'dark' ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          {/* Notifications */}
          <div className="dropdown-container" ref={notifRef}>
            <button 
              className="header-button" 
              onClick={() => setNotificationsOpen(!notificationsOpen)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
            </button>

            {notificationsOpen && (
              <div className="dropdown-menu notifications-dropdown">
                <div className="dropdown-header">
                  <h3>Notifications</h3>
                  <div className="dropdown-actions">
                    <button onClick={markAllAsRead} className="action-link">Mark all read</button>
                    <button onClick={clearNotifications} className="action-link">Clear all</button>
                  </div>
                </div>
                <div className="dropdown-content">
                  {notifications.length === 0 ? (
                    <div className="empty-state">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                      <p>No notifications</p>
                    </div>
                  ) : (
                    notifications.map(notif => (
                      <div 
                        key={notif.id} 
                        className={`notification-item ${notif.read ? 'read' : 'unread'}`}
                        onClick={() => markAsRead(notif.id)}
                      >
                        <div 
                          className="notification-icon" 
                          style={{ background: getNotificationColor(notif.type) + '20', color: getNotificationColor(notif.type) }}
                        >
                          {getNotificationIcon(notif.type)}
                        </div>
                        <div className="notification-content">
                          <div className="notification-title">{notif.title}</div>
                          <div className="notification-message">{notif.message}</div>
                          <div className="notification-time">{notif.time}</div>
                        </div>
                        {!notif.read && <span className="unread-dot"></span>}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile */}
          <div className="dropdown-container" ref={profileRef}>
            <button 
              className="user-button" 
              onClick={() => setProfileOpen(!profileOpen)}
            >
              <div className="user-avatar-small">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
              </div>
            </button>

            {profileOpen && (
              <div className="dropdown-menu profile-dropdown">
                <div className="profile-header">
                  <div className="profile-avatar">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                    </svg>
                  </div>
                  <div className="profile-info">
                    <div className="profile-name">Admin User</div>
                    <div className="profile-email">admin@iot.com</div>
                  </div>
                </div>
                <div className="profile-menu">
                  <Link to="/settings" className="profile-menu-item" onClick={() => setProfileOpen(false)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    My Profile
                  </Link>
                  <Link to="/settings" className="profile-menu-item" onClick={() => setProfileOpen(false)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Settings
                  </Link>
                  <button className="profile-menu-item logout-item" onClick={handleLogout}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Search Bar */}
      {searchOpen && (
        <div className="search-bar" ref={searchRef}>
          <form onSubmit={handleSearch}>
            <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search devices, blocks, or data..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            <button type="submit">Search</button>
          </form>
        </div>
      )}

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={toggleSidebar}></div>
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${location.pathname === item.path ? 'nav-item-active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <span className="nav-icon">{item.icon}</span>
              <div className="nav-text">
                <span className="nav-label">{item.label}</span>
                <span className="nav-description">{item.description}</span>
              </div>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
            </div>
            <div className="user-details">
              <div className="user-name">Admin User</div>
              <div className="user-email">admin@iot.com</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {children}
        <Footer />
      </main>
    </div>
  );
};

export default Layout;