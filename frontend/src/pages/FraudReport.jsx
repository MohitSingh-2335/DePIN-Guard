import { useEffect, useState, useCallback } from 'react';
import Layout from '../components/layout/Layout';
import { authenticatedFetch } from '../utils/api';
import './FraudReport.css';

export default function FraudReport() {
  const [alerts, setAlerts]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [filter, setFilter]         = useState('all');
  const [resolved, setResolved]     = useState(new Set());
  const [selectedAlert, setSelected] = useState(null);

  const fetchAlerts = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const res = await authenticatedFetch('/api/fraud-alerts');
      if (!res || !res.ok) throw new Error(`API error: ${res?.status}`);
      const data = await res.json();
      const alertsData = Array.isArray(data) ? data : (data.alerts || []);
      setAlerts(Array.isArray(alertsData) ? alertsData : []);
      setError(null);
    } catch (err) {
      setError('Could not load fraud alerts. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts(true);
    const interval = setInterval(() => fetchAlerts(false), 6000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  const getConfidenceRatio = (confidence) => {
    let c = parseFloat(confidence || 0);
    if (c > 1.0) c = c / 100.0;
    return c;
  };

  const getConfidenceColor = (confidence) => {
    const c = getConfidenceRatio(confidence);
    if (c > 0.8) return '#ef4444';
    if (c > 0.6) return '#f59e0b';
    return '#22c55e';
  };

  const getSeverity = (confidence) => {
    const c = getConfidenceRatio(confidence);
    if (c > 0.8) return 'high';
    if (c > 0.6) return 'medium';
    return 'low';
  };

  const getTypeIcon = (type) => {
    const t = type?.toLowerCase() || '';
    if (t.includes('cluster'))   return '[Cluster]';
    if (t.includes('frequency')) return '[Rate]';
    if (t.includes('injection')) return '[Inject]';
    return '[Alert]';
  };

  const filtered = alerts.filter(a => {
    const ratio = getConfidenceRatio(a.confidence);
    if (filter === 'resolved')   return resolved.has(a.id);
    if (filter === 'pending')    return !resolved.has(a.id);
    if (filter === 'high')       return ratio > 0.8;
    if (filter === 'medium')     return ratio > 0.6 && ratio <= 0.8;
    if (filter === 'low')        return ratio <= 0.6;
    return true;
  });

  const criticalCount  = alerts.filter(a => getConfidenceRatio(a.confidence) > 0.8).length;
  const resolvedCount  = resolved.size;
  const pendingCount   = alerts.length - resolvedCount;

  return (
    <Layout>
      <div className="fraud-container">

        {/* Header */}
        <div className="fraud-header">
          <div>
            <h1 className="fraud-title">Fraud Alerts</h1>
            <p className="fraud-subtitle">Real-time AI-detected systemic fraud patterns</p>
            {alerts.length > 0 && (
              <div className="fraud-alert-badge">
                <span className="fraud-alert-dot" />
                Live Monitoring ON
              </div>
            )}
          </div>
          <button
            className={`fraud-refresh-btn ${loading ? 'spinning' : ''}`}
            onClick={() => fetchAlerts(true)}
          >
            Refresh Data
          </button>
        </div>

        {/* ── Stats ── */}
        <div className="fraud-stats">
          <div className="fraud-stat-card">
            <div className="fraud-stat-num">{alerts.length}</div>
            <div className="fraud-stat-lbl">Total Alerts</div>
          </div>
          <div className="fraud-stat-card">
            <div className="fraud-stat-num" style={{ color: '#ef4444' }}>{criticalCount}</div>
            <div className="fraud-stat-lbl">Critical Risk</div>
          </div>
          <div className="fraud-stat-card">
            <div className="fraud-stat-num" style={{ color: '#f59e0b' }}>{pendingCount}</div>
            <div className="fraud-stat-lbl">Pending</div>
          </div>
          <div className="fraud-stat-card">
            <div className="fraud-stat-num" style={{ color: '#22c55e' }}>{resolvedCount}</div>
            <div className="fraud-stat-lbl">Resolved</div>
          </div>
        </div>

        {/* ── Loading / Error / Empty ── */}
        {loading && alerts.length === 0 ? (
          <div className="fraud-loading">
            <div className="fraud-spinner" />
            <p>Scanning network for fraud...</p>
          </div>
        ) : error ? (
          <div className="fraud-error"><p>Notice: {error}</p></div>
        ) : alerts.length === 0 ? (
          <div className="fraud-empty">
            <div className="check-icon">[OK]</div>
            <h3>System Secure</h3>
            <p>No suspicious patterns detected in recent blocks.</p>
          </div>
        ) : (
          <div className="fraud-table-container">

            {/* ── Panel header + filter ── */}
            <div className="fraud-panel-header">
              <span className="fraud-panel-title">
                Alert Log
                <span className="fraud-panel-badge">{filtered.length} alerts</span>
              </span>
              <div className="fraud-filter-row">
                {['all','high','medium','low','pending','resolved'].map(f => (
                  <button
                    key={f}
                    className={`fraud-filter-btn ${filter === f ? 'active' : ''}`}
                    onClick={() => setFilter(f)}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Table ── */}
            {filtered.length === 0 ? (
              <div className="fraud-empty" style={{ padding: '3rem' }}>
                <p style={{ color: '#64748b' }}>No alerts match this filter.</p>
              </div>
            ) : (
              <div className="fraud-table-scroll">
                <table className="fraud-table">
                  <thead>
                    <tr>
                      <th>Detection Type</th>
                      <th>Target Asset</th>
                      <th>Confidence</th>
                      <th>Time Detected</th>
                      <th>Severity</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((alert, i) => {
                      const rawConf    = parseFloat(alert.confidence || 0);
                      const confRatio  = rawConf > 1.0 ? rawConf / 100.0 : rawConf;
                      const confPercent = (confRatio * 100.0).toFixed(1);
                      const isResolved = resolved.has(alert.id);
                      return (
                        <tr
                          key={alert.id || i}
                          className={`
                            ${confRatio > 0.8 ? 'row-high' : ''}
                            ${isResolved ? 'row-resolved' : ''}
                          `}
                        >
                          <td>
                            <span className="type-badge">
                              {getTypeIcon(alert.type)} {alert.type?.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td>
                            <code className="asset-id">{alert.asset_id}</code>
                          </td>
                          <td>
                            <div className="confidence-cell">
                              <div className="conf-bar-bg">
                                <div
                                  className="conf-bar-fill"
                                  style={{
                                    width: `${confRatio * 100}%`,
                                    background: getConfidenceColor(confRatio),
                                  }}
                                />
                              </div>
                              <span style={{ color: getConfidenceColor(confRatio) }}>
                                {confPercent}%
                              </span>
                            </div>
                          </td>
                          <td className="timestamp">{alert.timestamp}</td>
                          <td>
                            <span
                              className={`risk-badge risk-${getSeverity(confRatio)}`}
                            >
                              {getSeverity(confRatio).toUpperCase()}
                            </span>
                          </td>
                          <td>
                            <div className="action-btns">
                              <button
                                className="row-action-btn"
                                title="View Details"
                                onClick={() => setSelected(alert)}
                              >
                                View
                              </button>
                              <button
                                className={`row-action-btn ${isResolved ? 'btn-resolved' : 'btn-resolve'}`}
                                title={isResolved ? 'Mark as Pending' : 'Mark as Resolved'}
                                onClick={() => {
                                  setResolved(prev => {
                                    const next = new Set(prev);
                                    isResolved ? next.delete(alert.id) : next.add(alert.id);
                                    return next;
                                  });
                                }}
                              >
                                {isResolved ? 'Undo' : 'Resolve'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Detail Modal ── */}
        {selectedAlert && (
          <div className="modal-overlay" onClick={() => setSelected(null)}>
            <div className="fraud-modal" onClick={e => e.stopPropagation()}>
              <div className="fraud-modal-header">
                <h2>Alert Details</h2>
                <button className="fraud-modal-close" onClick={() => setSelected(null)}>x</button>
              </div>
              <div className="fraud-modal-body">

                <div className="fraud-modal-section">
                  <div className="fraud-modal-section-title">Detection Info</div>
                  <div className="fraud-detail-grid">
                    <div className="fraud-detail-item">
                      <span className="fraud-detail-label">Type</span>
                      <span className="fraud-detail-value">
                        {getTypeIcon(selectedAlert.type)} {selectedAlert.type?.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="fraud-detail-item">
                      <span className="fraud-detail-label">Asset ID</span>
                      <span className="fraud-detail-value" style={{ fontFamily: 'monospace', color: '#0ea5e9' }}>
                        {selectedAlert.asset_id}
                      </span>
                    </div>
                    <div className="fraud-detail-item">
                      <span className="fraud-detail-label">Confidence</span>
                      <span className="fraud-detail-value" style={{ color: getConfidenceColor(selectedAlert.confidence) }}>
                        {(parseFloat(selectedAlert.confidence) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="fraud-detail-item">
                      <span className="fraud-detail-label">Severity</span>
                      <span className="fraud-detail-value">
                        {getSeverity(selectedAlert.confidence).toUpperCase()}
                      </span>
                    </div>
                    <div className="fraud-detail-item">
                      <span className="fraud-detail-label">Time Detected</span>
                      <span className="fraud-detail-value">{selectedAlert.timestamp}</span>
                    </div>
                    <div className="fraud-detail-item">
                      <span className="fraud-detail-label">Status</span>
                      <span className="fraud-detail-value" style={{ color: resolved.has(selectedAlert.id) ? '#22c55e' : '#f59e0b' }}>
                        {resolved.has(selectedAlert.id) ? 'Resolved' : 'Pending'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="fraud-modal-section">
                  <div className="fraud-modal-section-title">Suggested Action</div>
                  <p>
                    {parseFloat(selectedAlert.confidence) > 0.8
                      ? 'Critical: Immediately isolate the affected node and alert the security team. Do not allow further transactions until investigation is complete.'
                      : parseFloat(selectedAlert.confidence) > 0.6
                      ? 'Warning: Monitor the node closely for the next 30 minutes. Schedule an inspection if activity continues.'
                      : 'Notice: No immediate action needed. Continue monitoring. Flag for review in next routine check.'}
                  </p>
                </div>

              </div>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}