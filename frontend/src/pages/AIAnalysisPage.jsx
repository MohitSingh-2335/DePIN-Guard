import { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import './AIAnalysisPage.css';

const AIAnalysisPage = () => {
  // 1. STATE: Keep the exact same structure
  const [analysisResults, setAnalysisResults] = useState([]);
  const [aiStats, setAiStats] = useState({
    totalAnalyses: 0,
    anomaliesDetected: 0,
    accuracy: 94.2,
    modelsActive: 1
  });

  const [selectedAnalysis, setSelectedAnalysis] = useState(null);
  const [selectedModel, setSelectedModel] = useState('All Models');
  const [loading, setLoading] = useState(false);

  // We keep this list for the Filter Dropdown to work
  const aiModels = [
    'Isolation Forest',
    'LSTM Neural Network', 
    'Random Forest',
    'Deep Learning',
    'Autoencoder'
  ];

  // 2. FETCHER: The Secure Replacement
  const fetchRealData = async () => {
    try {
      // 2. Fetch with Secret Key
      const response = await fetch('/api/ai-analysis', {
        headers: {
          'X-API-Key': 'my-secret-depin-key-123', // <--- MUST MATCH PYTHON BACKEND
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) return;
      
      const data = await response.json();

      // Update Stats (Preserve the structure)
      setAiStats(prev => ({
        ...prev,
        totalAnalyses: data.total_analyses,
        anomaliesDetected: data.anomalies_found
      }));

      // Map Backend Data to the EXACT format your UI expects
      const mappedResults = data.recent_results.map((res, index) => ({
        id: index, // Backend doesn't send ID yet, so use index
        device: res.device,
        type: res.severity === 'high' ? 'Critical Anomaly' : 'Pattern Alert',
        severity: res.severity || 'medium',
        confidence: res.confidence,
        detected: res.timestamp,
        description: `Abnormal sensor behavior detected on ${res.device}. Value deviation observed.`, 
        recommendation: res.recommendation, // The REAL recommendation from Python
        aiModel: 'LSTM Neural Network' // We hardcode the model name for now
      }));

      setAnalysisResults(mappedResults);

    } catch (error) {
      console.error("AI Fetch Error:", error);
    }
  };

  // 3. EFFECT: Poll data
  useEffect(() => {
    fetchRealData();
    const interval = setInterval(fetchRealData, 3000); // Check every 3s
    return () => clearInterval(interval);
  }, []);

  // 4. HANDLERS
  
  // Filter logic
  const filteredResults = selectedModel === 'All Models' 
    ? analysisResults 
    : analysisResults.filter(a => a.aiModel === selectedModel);

  const handleModelChange = (e) => {
    setSelectedModel(e.target.value);
  };

  // "Run Analysis" now forces a refresh from Backend
  const handleRunAnalysis = () => {
    setLoading(true);
    fetchRealData();
    setTimeout(() => setLoading(false), 500); // Small fake delay for UI feedback
  };

  const getSeverityColor = (severity) => {
    // Safety check just in case backend sends nothing
    const s = severity ? severity.toLowerCase() : 'low';
    switch(s) {
      case 'high': return { bg: '#ef444420', text: '#ef4444' };
      case 'medium': return { bg: '#f59e0b20', text: '#f59e0b' };
      case 'low': return { bg: '#22c55e20', text: '#22c55e' };
      default: return { bg: '#6b728020', text: '#6b7280' };
    }
  };

  const viewAnalysisDetails = (analysis) => {
    setSelectedAnalysis(analysis);
  };

  const closeModal = () => {
    setSelectedAnalysis(null);
  };

  // 5. RENDER
  return (
    <Layout>
      <div className="ai-analysis-container">
        {/* Page Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">AI Analysis</h1>
            <p className="page-subtitle">Real-time anomaly detection and predictive analytics</p>
          </div>
          <button className="analyze-button" onClick={handleRunAnalysis}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            {loading ? 'Analyzing...' : 'Run Analysis'}
          </button>
        </div>

        {/* AI Stats */}
        <div className="ai-stats-grid">
          <div className="ai-stat-card">
            <div className="ai-stat-icon" style={{ background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="ai-stat-content">
              <div className="ai-stat-value">{aiStats.totalAnalyses.toLocaleString()}</div>
              <div className="ai-stat-label">Total Analyses</div>
            </div>
          </div>

          <div className="ai-stat-card">
            <div className="ai-stat-icon" style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="ai-stat-content">
              <div className="ai-stat-value">{aiStats.anomaliesDetected}</div>
              <div className="ai-stat-label">Anomalies Found</div>
            </div>
          </div>

          <div className="ai-stat-card">
            <div className="ai-stat-icon" style={{ background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ai-stat-content">
              <div className="ai-stat-value">{aiStats.accuracy.toFixed(1)}%</div>
              <div className="ai-stat-label">Model Accuracy</div>
            </div>
          </div>

          <div className="ai-stat-card">
            <div className="ai-stat-icon" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <div className="ai-stat-content">
              <div className="ai-stat-value">{aiStats.modelsActive}</div>
              <div className="ai-stat-label">Active Models</div>
            </div>
          </div>
        </div>

        {/* Analysis Results */}
        <div className="analysis-section">
          <div className="section-header">
            <h2 className="section-title">Recent Analysis Results</h2>
            <select className="model-filter" value={selectedModel} onChange={handleModelChange}>
              <option>All Models</option>
              {aiModels.map(model => (
                <option key={model}>{model}</option>
              ))}
            </select>
          </div>

          <div className="analysis-list">
            {/* Show Empty State if no data */}
            {filteredResults.length === 0 && (
                <div style={{padding:'30px', textAlign:'center', color:'#555'}}>
                    Waiting for AI processing...
                </div>
            )}

            {filteredResults.map((analysis) => (
              <div key={analysis.id} className="analysis-card">
                <div className="analysis-header">
                  <div className="analysis-device">
                    <div className="device-icon-ai">
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"/>
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
                      color: getSeverityColor(analysis.severity).text
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
                        background: analysis.confidence > 80 ? '#22c55e' : analysis.confidence > 60 ? '#f59e0b' : '#ef4444'
                      }}
                    ></div>
                  </div>
                </div>

                <div className="analysis-description">
                  {analysis.description}
                </div>

                <div className="analysis-meta">
                  <div className="meta-item">
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                    </svg>
                    {analysis.detected}
                  </div>
                  <div className="meta-item">
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                      <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                    </svg>
                    {analysis.aiModel}
                  </div>
                </div>

                <button 
                  className="view-recommendation-button"
                  onClick={() => viewAnalysisDetails(analysis)}
                >
                  View Recommendation
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Analysis Details Modal */}
        {selectedAnalysis && (
          <div className="modal-overlay" onClick={closeModal}>
            <div className="modal-content-ai" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header-ai">
                <h2>Analysis Details</h2>
                <button className="modal-close-ai" onClick={closeModal}>
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              <div className="modal-body-ai">
                <div className="detail-section">
                  <h3>Device Information</h3>
                  <p><strong>Device:</strong> {selectedAnalysis.device}</p>
                  <p><strong>Detection Type:</strong> {selectedAnalysis.type}</p>
                  <p><strong>Severity:</strong> <span style={{ color: getSeverityColor(selectedAnalysis.severity).text }}>{selectedAnalysis.severity.toUpperCase()}</span></p>
                </div>

                <div className="detail-section">
                  <h3>Analysis Details</h3>
                  <p><strong>Description:</strong></p>
                  <p>{selectedAnalysis.description}</p>
                  <p><strong>Confidence Level:</strong> {selectedAnalysis.confidence}%</p>
                  <p><strong>AI Model Used:</strong> {selectedAnalysis.aiModel}</p>
                  <p><strong>Detected At:</strong> {selectedAnalysis.detected}</p>
                </div>

                <div className="detail-section recommendation-section">
                  <h3>🎯 Recommendation</h3>
                  <div className="recommendation-box">
                    {selectedAnalysis.recommendation}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AIAnalysisPage;