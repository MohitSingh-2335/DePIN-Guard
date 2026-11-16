import { useState, useEffect, useCallback } from 'react';
import Layout from '../components/layout/Layout';
import { authenticatedFetch, getRefreshIntervalMs, formatUtcTimestamp } from '../utils/api';
import './AIAnalysisPage.css';

const AIAnalysisPage = () => {
  const [analysisResults, setAnalysisResults] = useState([]);
  const [aiStats, setAiStats] = useState({
    totalAnalyses: 0,
    anomaliesDetected: 0,
    accuracy: 82.4,
    gnnAccuracy: 87.65,
    modelsActive: 2,
  });
  const [aiModels, setAiModels] = useState([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);
  const [selectedModel, setSelectedModel] = useState('All Models');
  const [loading, setLoading] = useState(true);

  const fetchAIData = useCallback(async () => {
    try {
      const res = await authenticatedFetch('/api/ai-analysis');
      if (!res || !res.ok) return;

      const data = await res.json();
      if (!data) return;

      setAiStats({
        totalAnalyses: Number(data.total_analyses ?? 0),
        anomaliesDetected: Number(data.anomalies_found ?? 0),
        accuracy: data.accuracy ?? 82.4,
        gnnAccuracy: data.gnn_accuracy ?? 87.65,
        modelsActive: data.active_models_count ?? 2,
      });

      if (data.available_models && Array.isArray(data.available_models)) {
        setAiModels(data.available_models);
      }

      if (data.recent_results && Array.isArray(data.recent_results)) {
        setAnalysisResults(
          data.recent_results.map((rec, i) => ({
            id: rec.id ?? `${rec.device || 'device'}-${rec.timestamp || i}`,
            device: rec.device ?? 'Unknown',
            machine_name: rec.machine_name ?? rec.device ?? 'Unknown',
            type: rec.analysis_type ?? '6-Channel Temporal Reconstruction',
            severity: rec.severity ?? 'high',
            confidence: Math.min(100, Math.max(0, Number(rec.confidence ?? 85.0))),
            loss: Number(rec.loss ?? 0.0),
            threshold: Number(rec.threshold ?? 0.205),
            detected: rec.timestamp ?? new Date().toISOString(),
            description: rec.description ?? 'Sensor excursion detected above threshold',
            recommendation: rec.recommendation ?? 'Inspect physical equipment and cooling circuit.',
            aiModel: rec.model_name ?? 'PyTorch 6-Channel Temporal LSTM Autoencoder',
          }))
        );
      }
    } catch (error) {
      console.error('[AIAnalysis] Fetch failed:', error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAIData();
    const intervalMs = getRefreshIntervalMs(6000);
    if (!intervalMs) return undefined;
    const interval = setInterval(fetchAIData, intervalMs);
    return () => clearInterval(interval);
  }, [fetchAIData]);

  const filteredResults = selectedModel === 'All Models'
    ? analysisResults
    : analysisResults.filter(a => a.aiModel === selectedModel);

  const getSeverityColor = (severity) => {
    const s = (severity || '').toLowerCase();
    switch (s) {
      case 'critical':
      case 'high': return { bg: '#ef444420', text: '#ef4444' };
      case 'warning':
      case 'medium': return { bg: '#f59e0b20', text: '#f59e0b' };
      case 'normal':
      case 'low': return { bg: '#22c55e20', text: '#22c55e' };
      default: return { bg: '#6b728020', text: '#6b7280' };
    }
  };

  return (
    <Layout>
      <div className="ai-analysis-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">AI Anomaly Detection &amp; GNN Topology</h1>
            <p className="page-subtitle">
              Real-time 6-channel PyTorch LSTM Autoencoder reconstruction &amp; DeviceGCN graph cascade inference synced with MongoDB
            </p>
          </div>
          <button className="analyze-button" onClick={fetchAIData}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="20">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh Analysis
          </button>
        </div>

        {/* Stats Section (100% Identical to Dashboard, History & Fraud Alerts) */}
        <div className="ai-stats-grid">
          {[
            { bg: 'linear-gradient(135deg,#0ea5e9,#0284c7)', value: loading ? '...' : aiStats.totalAnalyses.toLocaleString(), label: 'Total Telemetry Scans (MongoDB)', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
            { bg: 'linear-gradient(135deg,#ef4444,#dc2626)', value: loading ? '...' : aiStats.anomaliesDetected.toLocaleString(), label: 'Flagged Anomalies (MongoDB)', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
            { bg: 'linear-gradient(135deg,#22c55e,#16a34a)', value: loading ? '...' : `${aiStats.accuracy}% / ${aiStats.gnnAccuracy}%`, label: 'LSTM / DeviceGCN F1 Accuracy', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
            { bg: 'linear-gradient(135deg,#8b5cf6,#7c3aed)', value: loading ? '...' : aiStats.modelsActive, label: 'Active PyTorch Engines', icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z' },
          ].map((stat, i) => (
            <div key={i} className="ai-stat-card">
              <div className="ai-stat-icon" style={{ background: stat.bg }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={stat.icon} />
                </svg>
              </div>
              <div className="ai-stat-content">
                <div className="ai-stat-value">{stat.value}</div>
                <div className="ai-stat-label">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Results Section */}
        <div className="analysis-section">
          <div className="section-header">
            <h2 className="section-title">Recent Anomaly Evaluations ({filteredResults.length} shown)</h2>
            <select
              className="model-filter"
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
            >
              <option>All Models</option>
              {aiModels.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {loading && analysisResults.length === 0 ? (
            <p className="status-message">Loading AI analysis from MongoDB...</p>
          ) : filteredResults.length === 0 ? (
            <p className="status-message">No anomaly excursions recorded yet — all 33 machines operating within nominal thresholds.</p>
          ) : (
            <div className="analysis-list">
              {filteredResults.map((analysis) => (
                <div key={analysis.id} className="analysis-card">
                  <div className="analysis-header">
                    <div className="analysis-device">
                      <div className="device-icon-ai">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <path d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                        </svg>
                      </div>
                      <div>
                        <div className="device-name-ai">
                          {analysis.device} {analysis.machine_name && analysis.machine_name !== analysis.device ? `· ${analysis.machine_name}` : ''}
                        </div>
                        <div className="analysis-type">{analysis.type}</div>
                      </div>
                    </div>
                    <div
                      className="severity-badge"
                      style={{
                        background: getSeverityColor(analysis.severity).bg,
                        color: getSeverityColor(analysis.severity).text,
                      }}
                    >
                      {analysis.severity.toUpperCase()}
                    </div>
                  </div>

                  <div className="confidence-bar-container">
                    <div className="confidence-label">
                      <span>Dynamic Model Confidence</span>
                      <span className="confidence-value">
                        {Number(analysis.confidence).toFixed(1)}%
                        {analysis.loss !== undefined && (
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 500, marginLeft: '6px' }}>
                            (MSE Loss: {Number(analysis.loss).toFixed(4)} vs {Number(analysis.threshold).toFixed(4)})
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="confidence-bar">
                      <div
                        className="confidence-fill"
                        style={{
                          width: `${analysis.confidence}%`,
                          background:
                            analysis.severity === 'critical' || analysis.severity === 'high'
                              ? '#ef4444'
                              : analysis.severity === 'medium' || analysis.severity === 'warning'
                              ? '#f59e0b'
                              : '#10b981',
                        }}
                      />
                    </div>
                  </div>

                  <div className="analysis-description">{analysis.description}</div>
                  <div className="analysis-meta">
                    <div className="meta-item">{formatUtcTimestamp(analysis.detected)}</div>
                    <div className="meta-item">{analysis.aiModel}</div>
                  </div>

                  <button className="view-recommendation-button" onClick={() => setSelectedAnalysis(analysis)}>
                    View Recommendation
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Logic */}
        {selectedAnalysis && (
          <div className="modal-overlay" onClick={() => setSelectedAnalysis(null)}>
            <div className="modal-content-ai" onClick={e => e.stopPropagation()}>
              <div className="modal-header-ai">
                <h2>AI Reconstruction Details</h2>
                <button onClick={() => setSelectedAnalysis(null)}>×</button>
              </div>
              <div className="modal-body-ai">
                <p><strong>Device:</strong> {selectedAnalysis.device} ({selectedAnalysis.machine_name})</p>
                <p><strong>Model:</strong> {selectedAnalysis.aiModel}</p>
                <p><strong>Severity:</strong> {selectedAnalysis.severity.toUpperCase()}</p>
                <p><strong>Dynamic Confidence:</strong> {Number(selectedAnalysis.confidence).toFixed(1)}%</p>
                <p><strong>Reconstruction MSE Loss:</strong> {Number(selectedAnalysis.loss).toFixed(6)} (Threshold: {Number(selectedAnalysis.threshold).toFixed(6)})</p>
                <p><strong>Detected At:</strong> {formatUtcTimestamp(selectedAnalysis.detected)}</p>
                <p><strong>Recommendation:</strong></p>
                <div className="recommendation-box">{selectedAnalysis.recommendation}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AIAnalysisPage;