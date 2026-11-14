import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BACKEND_URL } from '../utils/api';
import './LandingPage.css';

const FEATURES = [
  { tag: 'IoT', title: 'Real-Time IoT Monitoring', desc: 'Live sensor data — temperature, vibration, pressure, power — streamed instantly to your dashboard.' },
  { tag: 'Fabric', title: 'Blockchain Trust Layer', desc: 'Every data event is cryptographically hashed on Hyperledger Fabric. Tamper-proof audit trail guaranteed.' },
  { tag: 'AI', title: 'Dual AI Engine', desc: 'LSTM detects real-time anomalies. Graph Neural Network catches systemic fraud across the entire ledger.' },
  { tag: 'Security', title: 'Enterprise Security', desc: 'JWT + bcrypt + TLS + STRIDE threat modeling — defense in depth at every layer of the stack.' },
];

const STEPS = [
  { num: '01', title: 'Sensor Publishes', desc: 'IoT device sends JSON payload over MQTT broker to the ingestion service.' },
  { num: '02', title: 'AI Analyzes', desc: 'LSTM Autoencoder checks reconstruction error — anomaly flagged in milliseconds.' },
  { num: '03', title: 'Blockchain Records', desc: 'SHA-256 hash written to Hyperledger Fabric — immutable, tamper-proof.' },
  { num: '04', title: 'Dashboard Alerts', desc: 'WebSocket pushes live data to React dashboard. Red alert on anomaly detection.' },
];

const INDUSTRIES = [
  { tag: 'Mfg', label: 'Smart Manufacturing' },
  { tag: 'Energy', label: 'Energy Management' },
  { tag: 'Logistics', label: 'Supply Chain' },
  { tag: 'Pharma', label: 'Pharma Cold Chain' },
  { tag: 'Energy', label: 'Oil and Gas' },
  { tag: 'Infra', label: 'Structural Monitoring' },
];

const LandingPage = () => {
  const navigate = useNavigate();
  const [stats, setStats]               = useState({ devices: 0, threats: 0, uptime: 0 });
  const [loading, setLoading]           = useState(true);
  const [menuOpen, setMenuOpen]         = useState(false);
  const [contactForm, setContactForm]   = useState({ name: '', email: '', message: '' });
  const [contactSent, setContactSent]   = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('lp-visible'); }),
      { threshold: 0.12 }
    );
    document.querySelectorAll('.lp-fade').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const fetchStatsFromAPI = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${BACKEND_URL}/api/public/stats`);
        if (res.ok) {
          const data = await res.json();
          startCounterAnimation({
            devices: Number(data.devices) || 0,
            threats: Number(data.threats) || 0,
            uptime: Number(data.uptime) || 100.0,
          });
        } else {
          startCounterAnimation({ devices: 0, threats: 0, uptime: 100.0 });
        }
      } catch {
        startCounterAnimation({ devices: 0, threats: 0, uptime: 100.0 });
      } finally {
        setLoading(false);
      }
    };
    fetchStatsFromAPI();
  }, []);

  const startCounterAnimation = (target) => {
    const frames = 60;
    let currentFrame = 0;
    const timer = setInterval(() => {
      currentFrame++;
      const easeOut = 1 - Math.pow(1 - currentFrame / frames, 3);
      setStats({
        devices: Math.floor(easeOut * target.devices),
        threats: Math.floor(easeOut * target.threats),
        uptime:  (easeOut * target.uptime).toFixed(1),
      });
      if (currentFrame >= frames) clearInterval(timer);
    }, 2000 / frames);
  };

  const handleNavClick = (id) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleContactChange = e =>
    setContactForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleContactSubmit = (e) => {
    e.preventDefault();
    setContactSent(true);
    setTimeout(() => setContactSent(false), 4000);
    setContactForm({ name: '', email: '', message: '' });
  };

  return (
    <div className="lp-root" id="home">

      <div className="lp-bg">
        <div className="lp-grid" />
        <div className="lp-orb lp-orb1" />
        <div className="lp-orb lp-orb2" />
        <div className="lp-orb lp-orb3" />
      </div>

      <nav className="lp-nav">
        <div className="lp-nav-inner">
          <button className="lp-brand" onClick={() => handleNavClick('home')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="lp-brand-icon">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
            </svg>
            DePIN<span className="lp-brand-accent">Guard</span>
          </button>
          <div className="lp-nav-links">
            <button className="lp-nav-link" onClick={() => handleNavClick('features')}>Features</button>
            <button className="lp-nav-link" onClick={() => handleNavClick('how')}>How It Works</button>
            <button className="lp-nav-link" onClick={() => handleNavClick('industries')}>Industries</button>
            <button className="lp-nav-link" onClick={() => handleNavClick('contact')}>Contact</button>
          </div>
          <div className="lp-nav-actions">
            <button className="lp-btn-ghost" onClick={() => navigate('/login')}>Login</button>
            <button className="lp-btn-primary" onClick={() => navigate('/signup')}>Get Started</button>
          </div>
          <button className="lp-hamburger" onClick={() => setMenuOpen(!menuOpen)}>
            <span className={menuOpen ? 'open' : ''}/><span className={menuOpen ? 'open' : ''}/><span className={menuOpen ? 'open' : ''}/>
          </button>
        </div>
        {menuOpen && (
          <div className="lp-mobile-menu">
            <button className="lp-mobile-link" onClick={() => handleNavClick('features')}>Features</button>
            <button className="lp-mobile-link" onClick={() => handleNavClick('how')}>How It Works</button>
            <button className="lp-mobile-link" onClick={() => handleNavClick('industries')}>Industries</button>
            <button className="lp-mobile-link" onClick={() => handleNavClick('contact')}>Contact</button>
            <div className="lp-mobile-actions">
              <button className="lp-btn-ghost" onClick={() => navigate('/login')}>Login</button>
              <button className="lp-btn-primary" onClick={() => navigate('/signup')}>Get Started</button>
            </div>
          </div>
        )}
      </nav>

      <section className="lp-hero" id="hero">
        <div className="lp-hero-inner">
          <div className="lp-hero-badge">
            <span className="lp-badge-dot" /> Live Decentralized Monitoring
          </div>
          <h1 className="lp-hero-title">
            Industrial IoT Security<br />
            <span className="lp-hero-gradient">Powered by AI and Blockchain</span>
          </h1>
          <p className="lp-hero-desc">
            DePIN-Guard combines real-time LSTM anomaly detection with Hyperledger Fabric immutable audit trail,
            providing operators with verifiable trust in sensor data.
          </p>
          <div className="lp-hero-btns">
            <button className="lp-btn-cta" onClick={() => navigate('/signup')}>Start Monitoring Free</button>
            <button className="lp-btn-ghost-hero" onClick={() => navigate('/login')}>Sign in to Dashboard</button>
          </div>
          <div className="lp-stats">
            <div className="lp-stat">
              <div className="lp-stat-num">{loading && stats.devices === 0 ? '...' : `${stats.devices.toLocaleString()}`}</div>
              <div className="lp-stat-lbl">Active Devices</div>
            </div>
            <div className="lp-stat-div" />
            <div className="lp-stat">
              <div className="lp-stat-num">{loading && stats.threats === 0 ? '...' : stats.threats.toLocaleString()}</div>
              <div className="lp-stat-lbl">Threats Flagged</div>
            </div>
            <div className="lp-stat-div" />
            <div className="lp-stat">
              <div className="lp-stat-num">{loading && stats.uptime === 0 ? '...' : `${stats.uptime}%`}</div>
              <div className="lp-stat-lbl">Telemetry Health</div>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-section lp-section-dark" id="features">
        <div className="lp-section-inner">
          <div className="lp-section-eyebrow lp-fade">Core Capabilities</div>
          <h2 className="lp-section-title lp-fade">Everything You Need to Secure IoT</h2>
          <div className="lp-features-grid">
            {FEATURES.map((f, i) => (
              <div className="lp-feature-card lp-fade" key={i} style={{ transitionDelay: `${i * 80}ms` }}>
                <div className="lp-feature-icon-wrap" style={{ fontWeight: 'bold', fontSize: '13px', color: '#38bdf8' }}>[{f.tag}]</div>
                <h3 className="lp-feature-title">{f.title}</h3>
                <p className="lp-feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section" id="how">
        <div className="lp-section-inner">
          <div className="lp-section-eyebrow lp-fade">The Pipeline</div>
          <h2 className="lp-section-title lp-fade">From Sensor to Blockchain</h2>
          <div className="lp-steps">
            {STEPS.map((s, i) => (
              <div className="lp-step lp-fade" key={i} style={{ transitionDelay: `${i * 80}ms` }}>
                <div className="lp-step-number">{s.num}</div>
                <div className="lp-step-content">
                  <h4 className="lp-step-title">{s.title}</h4>
                  <p className="lp-step-desc">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section lp-section-dark" id="industries">
        <div className="lp-section-inner">
          <div className="lp-section-eyebrow lp-fade">Industries</div>
          <h2 className="lp-section-title lp-fade">Built for Critical Infrastructure</h2>
          <div className="lp-industries-grid">
            {INDUSTRIES.map((u, i) => (
              <div className="lp-industry-card lp-fade" key={i} style={{ transitionDelay: `${i * 60}ms` }}>
                <span className="lp-industry-icon" style={{ fontWeight: 'bold', fontSize: '13px', color: '#a78bfa' }}>[{u.tag}]</span>
                <span className="lp-industry-label">{u.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-cta-banner lp-fade">
        <div className="lp-cta-banner-inner">
          <h2 className="lp-cta-banner-title">Ready to secure your infrastructure?</h2>
          <p className="lp-cta-banner-sub">Join teams monitoring critical IoT networks with DePIN-Guard.</p>
          <button className="lp-btn-cta" onClick={() => navigate('/signup')}>Get Started Free</button>
        </div>
      </section>

      <section className="lp-section" id="contact">
        <div className="lp-section-inner lp-contact-inner">
          <div className="lp-section-eyebrow lp-fade">Get In Touch</div>
          <h2 className="lp-section-title lp-fade">Secure Your Network Today</h2>
          <div className="lp-contact-card lp-fade">
            {contactSent ? (
              <div className="lp-contact-success">
                <div className="lp-success-icon" style={{ fontWeight: 'bold', color: '#10b981' }}>[OK]</div>
                <h3>Transmission Received</h3>
                <p>Our security team will contact you shortly.</p>
              </div>
            ) : (
              <form onSubmit={handleContactSubmit} className="lp-contact-form">
                <div className="lp-form-row">
                  <div className="lp-form-group">
                    <label className="lp-form-label">Full Name</label>
                    <input type="text" name="name" value={contactForm.name} onChange={handleContactChange} placeholder="Enter your name" className="lp-form-input" required />
                  </div>
                  <div className="lp-form-group">
                    <label className="lp-form-label">Email Address</label>
                    <input type="email" name="email" value={contactForm.email} onChange={handleContactChange} placeholder="xyz@company.com" className="lp-form-input" required />
                  </div>
                </div>
                <div className="lp-form-group">
                  <label className="lp-form-label">Message</label>
                  <textarea name="message" value={contactForm.message} onChange={handleContactChange} placeholder="Tell us about your requirements..." className="lp-form-input lp-textarea" rows="4" required />
                </div>
                <button type="submit" className="lp-btn-cta">Send Message</button>
              </form>
            )}
          </div>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div className="lp-footer-top">
            <button className="lp-brand" onClick={() => handleNavClick('home')}>
              DePIN<span className="lp-brand-accent">Guard</span>
            </button>
            <div className="lp-footer-nav">
              <button className="lp-footer-link" onClick={() => handleNavClick('features')}>Features</button>
              <button className="lp-footer-link" onClick={() => handleNavClick('how')}>Docs</button>
              <a href="https://github.com/MohitSingh-2335/DePIN-Guard" target="_blank" rel="noreferrer" className="lp-footer-link">GitHub</a>
            </div>
          </div>

          <div className="lp-footer-links-section">
            <div className="lp-footer-col">
              <h4 className="lp-footer-col-title">Product</h4>
              <button className="lp-footer-link" onClick={() => handleNavClick('features')}>Features</button>
              <button className="lp-footer-link" onClick={() => handleNavClick('how')}>How It Works</button>
              <button className="lp-footer-link" onClick={() => handleNavClick('industries')}>Industries</button>
            </div>
            <div className="lp-footer-col">
              <h4 className="lp-footer-col-title">Resources</h4>
              <a href="https://github.com/MohitSingh-2335/DePIN-Guard" target="_blank" rel="noreferrer" className="lp-footer-link">GitHub</a>
              <button className="lp-footer-link">Documentation</button>
              <button className="lp-footer-link">API Reference</button>
            </div>
            <div className="lp-footer-col">
              <h4 className="lp-footer-col-title">Company</h4>
              <button className="lp-footer-link" onClick={() => handleNavClick('contact')}>Contact</button>
              <button className="lp-footer-link">Privacy Policy</button>
              <button className="lp-footer-link">Terms of Service</button>
            </div>
          </div>

          <div className="lp-footer-bottom">
            <p className="lp-footer-copy">2026 DePIN-Guard - BBD University, Lucknow - B.Tech CSE IoT</p>
            <p className="lp-footer-copy">Blockchain - AI - SCADA</p>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default LandingPage;
