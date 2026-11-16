import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Footer from './Footer';
import './Layout.css';

const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

const SEARCH_PAGES = [
  { keywords: ['dashboard', 'home', 'overview', 'stats'],  path: '/dashboard',    tag: 'DASH', label: 'Dashboard'    },
  { keywords: ['blockchain', 'block', 'chain', 'ledger'],  path: '/blockchain',   tag: 'CHAIN', label: 'Blockchain'   },
  { keywords: ['ai', 'analysis', 'anomaly', 'model'],      path: '/ai-analysis',  tag: 'AI', label: 'AI Analysis'  },
  { keywords: ['history', 'records', 'data', 'logs'],      path: '/history',      tag: 'HIST', label: 'History'      },
  { keywords: ['fraud', 'alert', 'report'],                path: '/fraud-alerts', tag: 'ALERTS', label: 'Fraud Alerts' },
  { keywords: ['security', 'tls', 'cert'],                 path: '/security',     tag: 'SEC', label: 'Security'     },
  { keywords: ['settings', 'profile', 'account'],          path: '/settings',     tag: 'SET', label: 'Settings'     },
];

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [profileOpen, setProfileOpen]   = useState(false);
  const [searchOpen, setSearchOpen]     = useState(false);
  const [searchQuery, setSearchQuery]   = useState('');
  const [searchResult, setSearchResult] = useState('');
  const [theme, setTheme]               = useState(savedTheme);
  const [isOnline, setIsOnline]         = useState(navigator.onLine);

  const location   = useLocation();
  const navigate   = useNavigate();
  const profileRef = useRef(null);

  useEffect(() => {
    const onOnline  = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Theme apply
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const handleClick = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setSearchQuery('');
        setSearchResult('');
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, []);

  const userName  = localStorage.getItem('userName') || localStorage.getItem('username') || localStorage.getItem('user') || 'Admin User';
  const userEmail = localStorage.getItem('userEmail') || localStorage.getItem('email') || 'admin@iot.com';

  const handleSearch = (e) => {
    e.preventDefault();
    const q = searchQuery.toLowerCase().trim();
    if (!q) return;

    const match = SEARCH_PAGES.find(page =>
      page.keywords.some(kw => q.includes(kw))
    );

    if (match) {
      navigate(match.path);
      setSearchOpen(false);
      setSearchQuery('');
      setSearchResult('');
    } else {
      setSearchResult(`No page found for "${searchQuery}"`);
    }
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResult('');
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      localStorage.removeItem('token');
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('security_unlocked');
      localStorage.removeItem('userName');
      localStorage.removeItem('userEmail');
      navigate('/login');
    }
  };

  const navItems = [
    {
      path: '/dashboard',
      label: 'Dashboard',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18" height="18">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      path: '/blockchain',
      label: 'Blockchain',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18" height="18">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
    },
    {
      path: '/ai-analysis',
      label: 'AI Analysis',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18" height="18">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      path: '/history',
      label: 'History',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18" height="18">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      path: '/fraud-alerts',
      label: 'Fraud Alerts',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18" height="18">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
    {
      path: '/security',
      label: 'Security',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18" height="18">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
    {
      path: '/settings',
      label: 'Settings',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18" height="18">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div className={`layout ${theme}-theme`}>

      {searchOpen && (
        <div className="search-overlay" onClick={closeSearch}>
          <div className="search-container" onClick={e => e.stopPropagation()}>
            <form onSubmit={handleSearch} className="search-form">
              <input
                type="text"
                placeholder="Search page... (dashboard, blockchain, ai...)"
                autoFocus
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setSearchResult(''); }}
              />
              <button type="submit">Go →</button>
            </form>

            <div className="search-quick-links">
              {SEARCH_PAGES.map(page => (
                <button
                  key={page.path}
                  className="search-quick-btn"
                  onClick={() => { navigate(page.path); closeSearch(); }}
                >
                  [{page.tag}] {page.label}
                </button>
              ))}
            </div>

            {searchResult && <p className="search-no-result">{searchResult}</p>}
            <p className="search-hint">Press Esc to close</p>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="header">
        <div className="header-left">
          <button className="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>Menu</button>
          <span className="logo-text">IoT Dashboard</span>
        </div>

        <div className="header-right">

          <div
            className={`status-indicator ${isOnline ? 'online' : 'offline'}`}
            title={isOnline ? 'Connected to internet' : 'No internet connection'}
          >
            <span className="status-dot"></span>
            <span>{isOnline ? 'Online' : 'Offline'}</span>
          </div>

          <button className="header-button" title="Search pages (Ctrl+K)" onClick={() => setSearchOpen(true)}>
            Search
          </button>

          <div className="dropdown-container" ref={profileRef}>
            <button className="user-button" onClick={() => setProfileOpen(!profileOpen)}>
              <div className="user-avatar-small">{userName.charAt(0)}</div>
            </button>
            {profileOpen && (
              <div className="profile-dropdown">
                <button className="profile-menu-item" onClick={() => { navigate('/settings'); setProfileOpen(false); }}>
                  Profile
                </button>
                <button className="profile-menu-item logout-item" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

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
              </div>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{userName.charAt(0)}</div>
            <div className="user-details">
              <div className="user-name">{userName}</div>
              <div className="user-email">{userEmail}</div>
            </div>
          </div>
          <button className="sidebar-logout" onClick={handleLogout}>Exit</button>
        </div>
      </aside>

      <main className="main-content">
        {children}
        <Footer />
      </main>

    </div>
  );
};

export default Layout;