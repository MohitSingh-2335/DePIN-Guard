import { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import { authenticatedFetch } from '../utils/api';
import './AIAnalysisPage.css';

const AIAnalysisPage = () => {
  const [analysisResults, setAnalysisResults] = useState([]);
  const [aiStats, setAiStats] = useState({
    totalAnalyses: 0,
    anomaliesDetected: 0,
    accuracy: 0,
    modelsActive: 0,
  });
  const [aiModels, setAiModels] = useState([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);
  const [selectedModel, setSelectedModel] = useState('All Models');
  const [loading, setLoading] = useState(true);

  const fetchAIData = async () => {
    try {
      const res = await authenticatedFetch('/api/ai-analysis');
      if (!res) {
        return;
      }
      
      if (!res.ok) {
        return;
      }

      const data = await res.json();
      if (!data) {
        return;
      }

      setAiStats({
        totalAnalyses:     data.total_analyses   ?? 0,
        anomaliesDetected: data.anomalies_found  ?? 0,
        accuracy:          data.accuracy         ?? 0,
        modelsActive:      data.active_models_count ?? 0,
      });

      if (data.available_models && Array.isArray(data.available_models)) {
        setAiModels(data.available_models);
      }

      if (data.recent_results && Array.isArray(data.recent_results)) {
        setAnalysisResults(prev => {
          const existingIds = new Set(prev.map(r => r.id));
          
          const newResults = data.recent_results
            .filter(r => !existingIds.has(r.id))
            .map((rec, i) => ({
              id:             rec.id ?? `${rec.device || 'device'}-${rec.timestamp || Date.now()}-${i}`,
              device:         rec.device         ?? 'Unknown',
              type:           rec.analysis_type  ?? 'N/A',
              severity:       rec.severity       ?? 'low',
              confidence:     Math.min(100, Math.max(0, rec.confidence ?? 0)),
              detected:       rec.timestamp      ?? new Date().toLocaleTimeString(),
              description:    rec.description    ?? 'No description',
              recommendation: rec.recommendation ?? 'No recommendation',
              aiModel:        rec.model_name     ?? 'N/A',
            }));

          return [...newResults, ...prev].slice(0, 50);
        });
      }
    } catch (error) {
      console.error('[AIAnalysis] Fetch failed:', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAIData();
    const interval = setInterval(fetchAIData, 6000);
    return () => clearInterval(interval);
  }, []);

  const filteredResults = selectedModel === 'All Models'
    ? analysisResults
    : analysisResults.filter(a => a.aiModel === selectedModel);

  const getSeverityColor = (severity) => {
    const s = severity.toLowerCase();
    switch (s) {
      case 'high':   return { bg: '#ef444420', text: '#ef4444' };
      case 'medium': return { bg: '#f59e0b20', text: '#f59e0b' };
      case 'low':    return { bg: '#22c55e20', text: '#22c55e' };
      default:       return { bg: '#6b728020', text: '#6b7280' };
    }
  };

  return (
    <Layout>
      <div className="ai-analysis-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">AI Analysis</h1>
            <p className="page-subtitle">Real-time anomaly detection and predictive analytics</p>
          </div>
          <button className="analyze-button" onClick={fetchAIData}>
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="20">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
             </svg>
            Refresh Analysis
          </button>
        </div>

        {/* Stats Section */}
        <div className="ai-stats-grid">
          {[
            { bg: 'linear-gradient(135deg,#0ea5e9,#0284c7)', value: loading ? '...' : aiStats.totalAnalyses.toLocaleString(), label: 'Total Analyses',     icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
            { bg: 'linear-gradient(135deg,#ef4444,#dc2626)', value: loading ? '...' : aiStats.anomaliesDetected, label: 'Anomalies Found',    icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
            { bg: 'linear-gradient(135deg,#22c55e,#16a34a)', value: loading ? '...' : `${aiStats.accuracy}%`, label: 'Model Accuracy',  icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
            { bg: 'linear-gradient(135deg,#8b5cf6,#7c3aed)', value: loading ? '...' : aiStats.modelsActive, label: 'Active Models',    icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z' },
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
            <h2 className="section-title">Recent Analysis Results</h2>
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
            <p className="status-message">Loading AI analysis...</p>
          ) : filteredResults.length === 0 ? (
            <p className="status-message">No data available for the selected model.</p>
          ) : (
            <div className="analysis-list">
              {filteredResults.map((analysis) => (
                <div key={analysis.id} className="analysis-card">
                  {/* Card content remains same but uses 'analysis' properties mapped from backend */}
                  <div className="analysis-header">
                    <div className="analysis-device">
                      <div className="device-icon-ai">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <path d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                        </svg>
                      </div>
                      <div>
                        <div className="device-name-ai">{analysis.device}</div>
                        <div className="analysis-type">{analysis.type}</div>
                      </div>
                    </div>
                    <div
                      className="severity-badge"
                      style={{
                        background: getSeverityColor(analysis.severity).bg,
                        color:      getSeverityColor(analysis.severity).text,
                      }}
                    >
                      {analysis.severity.toUpperCase()}
                    </div>
                  </div>

                  <div className="confidence-bar-container">
                    <div className="confidence-label">
                      <span>Confidence</span>
                      <span className="confidence-value">{analysis.confidence}%</span>
                    </div>
                    <div className="confidence-bar">
                      <div
                        className="confidence-fill"
                        style={{
                          width: `${analysis.confidence}%`,
                          background: analysis.confidence > 80 ? '#22c55e' : analysis.confidence > 60 ? '#f59e0b' : '#ef4444',
                        }}
                      />
                    </div>
                  </div>

                  <div className="analysis-description">{analysis.description}</div>
                  <div className="analysis-meta">
                    <div className="meta-item">{analysis.detected}</div>
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

        {/* Modal Logic remains same but uses 'selectedAnalysis' object */}
        {selectedAnalysis && (
           <div className="modal-overlay" onClick={() => setSelectedAnalysis(null)}>
             <div className="modal-content-ai" onClick={e => e.stopPropagation()}>
               {/* Modal details mapping from backend data */}
               <div className="modal-header-ai">
                  <h2>Analysis Details</h2>
                  <button onClick={() => setSelectedAnalysis(null)}>×</button>
               </div>
               <div className="modal-body-ai">
                  <p><strong>Model:</strong> {selectedAnalysis.aiModel}</p>
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