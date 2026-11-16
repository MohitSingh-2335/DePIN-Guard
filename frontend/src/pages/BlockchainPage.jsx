import { useState, useEffect, useCallback } from 'react';
import Layout from '../components/layout/Layout';
import { authenticatedFetch, getRefreshIntervalMs, formatUtcTimestamp } from '../utils/api';
import './BlockchainPage.css';

const BlockchainPage = () => {
  const [blocks, setBlocks] = useState([]);
  const [stats, setStats] = useState({
    totalBlocks: 1,
    transactions: 1,
    anomaliesAnchored: 0,
    networkStatus: 'Active',
  });
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchBlockchainData = useCallback(async () => {
    try {
      const res = await authenticatedFetch('/api/blockchain');
      if (!res || !res.ok) return;

      const data = await res.json();
      if (!data) return;

      setStats({
        totalBlocks: Number(data.total_blocks ?? 1),
        transactions: Number(data.transactions ?? 1),
        anomaliesAnchored: Number(data.anomalies_anchored ?? 0),
        networkStatus: data.net_status ?? 'Active',
      });

      if (data.recent_blocks && Array.isArray(data.recent_blocks)) {
        setBlocks(data.recent_blocks);
      }
    } catch (error) {
      console.error('[Blockchain] Fetch failed:', error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBlockchainData();
    const intervalMs = getRefreshIntervalMs(6000);
    if (!intervalMs) return undefined;
    const interval = setInterval(fetchBlockchainData, intervalMs);
    return () => clearInterval(interval);
  }, [fetchBlockchainData]);

  const getStatusClass = (status) => {
    const s = status?.toLowerCase() || 'confirmed';
    if (s === 'confirmed' || s === 'success') return 'status-confirmed';
    if (s === 'pending' || s === 'mempool') return 'status-pending';
    return 'status-error';
  };

  return (
    <Layout>
      <div className="blockchain-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">Blockchain Consortium Ledger Explorer</h1>
            <p className="page-subtitle">Immutable SHA-256 anomaly anchoring and transaction throughput synced with MongoDB</p>
          </div>
          <button className="sync-button" onClick={fetchBlockchainData}>
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" style={{ marginRight: '8px' }}>
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
            Sync Network
          </button>
        </div>

        {/* Dynamic Stats Section */}
        <div className="blockchain-stats-grid">
          <div className="stat-card-blockchain">
            <div className="stat-label-blockchain">Total Committed Blocks</div>
            <div className="stat-value-blockchain">
              {loading ? '...' : stats.totalBlocks.toLocaleString()}
            </div>
          </div>
          <div className="stat-card-blockchain">
            <div className="stat-label-blockchain">Anchored Transactions</div>
            <div className="stat-value-blockchain">
              {loading ? '...' : stats.transactions.toLocaleString()}
            </div>
          </div>
          <div className="stat-card-blockchain">
            <div className="stat-label-blockchain">Ledger Health</div>
            <div className="stat-value-blockchain" style={{ color: '#22c55e' }}>
              {loading ? '...' : stats.networkStatus}
            </div>
          </div>
        </div>

        {/* Blocks List */}
        <div className="blocks-section">
          {loading && blocks.length === 0 ? (
            <div className="loader-container">
              <div className="spinner"></div>
              <p>Fetching latest blocks from MongoDB ledger...</p>
            </div>
          ) : blocks.length === 0 ? (
            <p className="empty-state">No blocks found on the network.</p>
          ) : (
            <div className="blocks-list">
              {blocks.map((block, idx) => (
                <div key={block.hash || block.id || idx} className="block-card">
                  <div className="block-header">
                    <div className="block-height">Block #{block.index ?? block.id ?? idx}</div>
                    <span className={`block-status ${getStatusClass(block.status)}`}>
                      {block.status || 'Confirmed'}
                    </span>
                  </div>

                  <div className="block-info-grid">
                    <div className="info-item">
                      <div className="info-label">Current Hash</div>
                      <code className="info-value">
                        {block.hash ? `${block.hash.substring(0, 12)}...${block.hash.slice(-8)}` : '—'}
                      </code>
                    </div>
                    <div className="info-item">
                      <div className="info-label">Previous Hash</div>
                      <code className="info-value">
                        {block.prev_hash ? `${block.prev_hash.substring(0, 12)}...` : '—'}
                      </code>
                    </div>
                    <div className="info-item">
                      <div className="info-label">Timestamp</div>
                      <div className="info-value">{formatUtcTimestamp(block.timestamp)}</div>
                    </div>
                    <div className="info-item">
                      <div className="info-label">Target Node / Validator</div>
                      <div className="info-value">{block.device_id || block.validator || 'Consortium-Orderer'}</div>
                    </div>
                  </div>

                  <button
                    className="view-details-button"
                    onClick={() => setSelectedBlock(block)}
                  >
                    View Ledger Details
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail Modal */}
        {selectedBlock && (
          <div className="modal-overlay" onClick={() => setSelectedBlock(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Block Analysis — #{selectedBlock.index ?? selectedBlock.id}</h2>
                <button className="close-btn" onClick={() => setSelectedBlock(null)}>×</button>
              </div>
              <div className="modal-body">
                <div className="detail-row">
                  <span className="detail-key">Full Hash:</span>
                  <code className="detail-val break-all">{selectedBlock.hash}</code>
                </div>
                <div className="detail-row">
                  <span className="detail-key">Parent Hash:</span>
                  <code className="detail-val break-all">{selectedBlock.prev_hash}</code>
                </div>
                <div className="detail-row">
                  <span className="detail-key">Merkle Root:</span>
                  <code className="detail-val break-all">{selectedBlock.merkle_root || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'}</code>
                </div>
                {selectedBlock.device_id && (
                  <div className="detail-row">
                    <span className="detail-key">Target Device:</span>
                    <span className="detail-val" style={{ color: '#38bdf8', fontWeight: 600 }}>{selectedBlock.device_id}</span>
                  </div>
                )}
                {selectedBlock.anomaly_score !== undefined && (
                  <div className="detail-row">
                    <span className="detail-key">Anomaly Loss Score:</span>
                    <span className="detail-val" style={{ color: '#ef4444', fontWeight: 600 }}>{selectedBlock.anomaly_score}</span>
                  </div>
                )}
                <div className="detail-row">
                  <span className="detail-key">Consortium Org:</span>
                  <span className="detail-val">{selectedBlock.orgMSP || 'ManufacturerMSP'}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-key">Timestamp:</span>
                  <span className="detail-val">{formatUtcTimestamp(selectedBlock.timestamp)}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-key">Transactions:</span>
                  <span className="detail-val">{selectedBlock.transactions || selectedBlock.tx_count || 1} TX</span>
                </div>
                <div className="detail-row">
                  <span className="detail-key">Status:</span>
                  <span className={`detail-val ${getStatusClass(selectedBlock.status)}`}>
                    {selectedBlock.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default BlockchainPage;