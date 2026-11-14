import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Footer from './Footer';
import './Layout.css';
import { TeamAccessControl } from '../../utils/TeamAccessControl';

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

  const isTeamMember = TeamAccessControl.isTeamMember(userEmail);
  const isAdmin = localStorage.getItem("isAdmin") === "true";

  const handleSearch = (e) => {
    e.preventDefault();
    const q = searchQuery.toLowerCase().trim();
    if (!q) return;

    const match = SEARCH_PAGES
      .filter(page => page.path !== '/security' || isTeamMember || isAdmin)
      .find(page =>
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
    { path: '/dashboard',    tag: 'DASH', label: 'Dashboard'    },
    { path: '/blockchain',   tag: 'CHAIN', label: 'Blockchain'   },
    { path: '/ai-analysis',  tag: 'AI', label: 'AI Analysis'  },
    { path: '/history',      tag: 'HIST', label: 'History'      },
    { path: '/fraud-alerts', tag: 'ALERT', label: 'Fraud Alerts' },
    ...(isTeamMember || isAdmin
      ? [{ path: '/security', tag: 'SEC', label: 'Security' }]
      : []),
    { path: '/settings',     tag: 'SET', label: 'Settings'     },
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
              {SEARCH_PAGES
                .filter(page => page.path !== '/security' || isTeamMember || isAdmin)
                .map(page => (
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
              <span className="nav-icon" style={{ fontSize: 11, fontWeight: 'bold' }}>[{item.tag}]</span>
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