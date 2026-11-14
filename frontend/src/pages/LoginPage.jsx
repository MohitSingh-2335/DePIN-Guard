import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './AuthPages.css';
import { authFetch } from '../utils/authApi';
import { storeAuthToken, storeUserProfile } from '../utils/sessionAuth';

const LoginPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '', password: '', rememberMe: false });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    const savedEmail = localStorage.getItem('savedEmail') || localStorage.getItem('userEmail') || '';
    const rememberMe = localStorage.getItem('rememberMe') === 'true';
    setFormData(prev => ({ ...prev, email: savedEmail, rememberMe }));
  }, []);

  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (fieldErrors[name]) setFieldErrors(prev => ({ ...prev, [name]: '' }));
    if (error) setError('');
  };

  const validate = () => {
    const errors = {};
    if (!formData.email) errors.email = 'Email is required.';
    else if (!isValidEmail(formData.email)) errors.email = 'Please enter a valid email address.';
    if (!formData.password) errors.password = 'Password is required.';
    else if (formData.password.length < 8) errors.password = 'Password must be at least 8 characters.';
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validate();
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }

    setIsLoading(true);
    setError('');

    try {
      // Auth request goes through Vite proxy (/login -> auth-service)
      const response = await authFetch('/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Invalid credentials');
      }

      const data = await response.json();
      const token = data.access_token;

      storeAuthToken(token, formData.rememberMe);
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('rememberMe', String(formData.rememberMe));
      localStorage.setItem('savedEmail', formData.email);
      localStorage.setItem('userEmail', formData.email);
      
      // Store user profile from auth service response
      storeUserProfile({ 
        email: formData.email, 
        full_name: data.full_name || formData.email 
      });

      navigate('/dashboard');

    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-background">
        <div className="grid-overlay" />
        <div className="floating-particles">
          {[...Array(15)].map((_, i) => (
            <div key={i} className="particle" style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${15 + Math.random() * 10}s`
            }} />
          ))}
        </div>
      </div>

      <div className="auth-wrapper">
        <div className="auth-card">
          <div className="auth-header">
            <div className="logo-container">
              <svg className="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 17L12 22L22 17" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 12L12 17L22 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="brand-name-tag">DePIN-Guard</div>
            </div>
            <h1 className="auth-title">Welcome Back</h1>
            <p className="auth-subtitle">
              Login to monitor your <span className="highlight-text">IoT devices</span>,
              view <span className="highlight-text">AI anomaly alerts</span>, and check your
              <span className="highlight-text"> blockchain audit trail</span>.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            {error && <div className="error-message">{error}</div>}

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email" name="email"
                value={formData.email} onChange={handleChange}
                placeholder="your@email.com"
                className={`form-input ${fieldErrors.email ? 'input-error' : ''}`}
              />
              {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password} onChange={handleChange}
                  placeholder="Enter your password"
                  className={`form-input ${fieldErrors.password ? 'input-error' : ''}`}
                />
                <button type="button" className="password-toggle-icon" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {fieldErrors.password && <span className="field-error">{fieldErrors.password}</span>}
            </div>

            <div className="form-options">
              <label className="checkbox-label">
                <input type="checkbox" name="rememberMe" checked={formData.rememberMe} onChange={handleChange} />
                <span>Remember me</span>
              </label>
            </div>

            <button type="submit" className="submit-button" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Login to Dashboard'}
            </button>
          </form>

          <div className="auth-footer">
            <p className="footer-text">
              Don't have an account? <Link to="/signup" className="footer-link">Sign up free</Link>
            </p>
            <p className="footer-text" style={{ marginTop: '0.5rem' }}>
              <Link to="/" className="footer-link">← Back to Home</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;