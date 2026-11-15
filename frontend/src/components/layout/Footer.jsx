import './Footer.css';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="app-footer">
      <div className="footer-content">
        {/* Brand Section */}
        <div className="footer-section footer-brand">
          <div className="footer-logo">
            <svg className="footer-logo-icon" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>DePIN-Guard</span>
          </div>
          <p className="footer-description">
            Decentralized physical infrastructure security and AI anomaly detection platform for industrial SCADA and manufacturing environments.
          </p>

          {/* Social / Code Links */}
          <div className="footer-social">
            <a href="https://github.com/MohitSingh-2335/DePIN-Guard" target="_blank" rel="noopener noreferrer" className="social-link" aria-label="GitHub">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.840 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
            </a>
          </div>
        </div>

        {/* Navigation */}
        <div className="footer-section">
          <h3 className="footer-title">Platform</h3>
          <ul className="footer-links">
            <li><a href="/dashboard">Telemetry Dashboard</a></li>
            <li><a href="/blockchain">Blockchain Audit</a></li>
            <li><a href="/ai-analysis">AI Anomaly Engine</a></li>
            <li><a href="/history">Historical Logs</a></li>
            <li><a href="/security">Security &amp; Pentest</a></li>
          </ul>
        </div>

        {/* Architecture */}
        <div className="footer-section">
          <h3 className="footer-title">Architecture</h3>
          <ul className="footer-links">
            <li><span style={{ color: '#94a3b8' }}>PyTorch LSTM Autoencoder</span></li>
            <li><span style={{ color: '#94a3b8' }}>PyTorch Geometric DeviceGCN</span></li>
            <li><span style={{ color: '#94a3b8' }}>Hyperledger Fabric / Hash-Chain</span></li>
            <li><span style={{ color: '#94a3b8' }}>FastAPI + Motor MongoDB</span></li>
            <li><span style={{ color: '#94a3b8' }}>React + Vite + Recharts</span></li>
          </ul>
        </div>

        {/* Verification Standards */}
        <div className="footer-section">
          <h3 className="footer-title">Telemetry Integrity</h3>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.6, marginBottom: '16px' }}>
            All sensor payloads are HMAC-SHA256 authenticated, bounded to 33 plant machines, and cryptographically verified.
          </p>
          <div className="trust-badges">
            <div className="trust-badge">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
              </svg>
              <span>HMAC Signed</span>
            </div>
            <div className="trust-badge">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              <span>Audit Trail</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Bottom */}
      <div className="footer-bottom">
        <div className="footer-bottom-content">
          <p className="copyright">
            &copy; {currentYear} DePIN-Guard. Open-source industrial security.
          </p>
          <p className="made-with">
            Built for Industrial IoT &amp; Decentralized Trust
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;