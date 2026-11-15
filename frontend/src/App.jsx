import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import BlockchainPage from './pages/BlockchainPage';
import AIAnalysisPage from './pages/AIAnalysisPage';
import HistoryPage from './pages/HistoryPage';
import SettingsPage from './pages/SettingsPage';
import LandingPage from './pages/LandingPage';
import FraudReport from './pages/FraudReport';
import { getStoredToken, clearAuthStorage } from './utils/sessionAuth';
import SecurityPage from './pages/SecurityPage';

// Log environment configuration
if (typeof window !== 'undefined') {
  console.log('Frontend Configuration:');
  console.log('  API URL:', import.meta.env.VITE_API_URL || 'http://localhost:8000');
}

const isTokenUsable = (token) => {
  if (!token || token === 'null') return false;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;

    const payload = JSON.parse(atob(parts[1]));
    if (!payload.exp) return true;

    return payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
};

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('React Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          background: '#060a12',
          color: '#fff',
          flexDirection: 'column',
          gap: '20px',
          fontFamily: 'monospace',
          padding: '20px'
        }}>
          <h1>Application Error</h1>
          <p>Error: {this.state.error?.message}</p>
          <button onClick={() => window.location.reload()} style={{
            padding: '10px 20px',
            background: '#00c2ff',
            border: 'none',
            color: '#000',
            cursor: 'pointer',
            borderRadius: '4px'
          }}>
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const ProtectedRoute = ({ children }) => {
  const token = getStoredToken();
  if (!isTokenUsable(token)) {
    clearAuthStorage();
    return <Navigate to="/login" replace />;
  }
  return children;
};

const SecurityProtectedRoute = ({ children }) => {
  const token = getStoredToken();
  if (!isTokenUsable(token)) {
    clearAuthStorage();
    return <Navigate to="/login" replace />;
  }
  return children;
};

// Public route
const PublicRoute = ({ children }) => {
  const token = getStoredToken();
  if (isTokenUsable(token)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

function App() {
  return (
    <ErrorBoundary>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>

          <Route path="/" element={<LandingPage />} />

          <Route path="/login" element={
            <PublicRoute><LoginPage /></PublicRoute>
          } />
          <Route path="/signup" element={
            <PublicRoute><SignupPage /></PublicRoute>
          } />

          <Route path="/dashboard" element={
            <ProtectedRoute><DashboardPage /></ProtectedRoute>
          } />
          <Route path="/blockchain" element={
            <ProtectedRoute><BlockchainPage /></ProtectedRoute>
          } />
          <Route path="/ai-analysis" element={
            <ProtectedRoute><AIAnalysisPage /></ProtectedRoute>
          } />
          <Route path="/history" element={
            <ProtectedRoute><HistoryPage /></ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute><SettingsPage /></ProtectedRoute>
          } />
          <Route path="/fraud-alerts" element={
            <ProtectedRoute><FraudReport /></ProtectedRoute>
          } />

          <Route path="/security" element={
            <SecurityProtectedRoute>
              <SecurityPage />
            </SecurityProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;