import { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import './BlockchainPage.css';

const BlockchainPage = () => {
  const [blocks, setBlocks] = useState([
    {
      id: 1,
      height: 12543,
      hash: '0x7a8f3e2d9b4c1a5f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5',
      previousHash: '0x9b4c1a5f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1',
      timestamp: new Date().toLocaleString('en-GB', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      }).replace(/\//g, '-'),
      transactions: 24,
      miner: 'Peer-01',
      status: 'confirmed'
    },
    {
      id: 2,
      height: 12542,
      hash: '0x9b4c1a5f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1',
      previousHash: '0x2d6e4b8c7a9f3e1d5c0b4a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8',
      timestamp: new Date(Date.now() - 5 * 60000).toLocaleString('en-GB', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      }).replace(/\//g, '-'),
      transactions: 18,
      miner: 'Peer-02',
      status: 'confirmed'
    },
    {
      id: 3,
      height: 12541,
      hash: '0x2d6e4b8c7a9f3e1d5c0b4a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8',
      previousHash: '0x5c1a9e3f7d6b8c4a2f1e0d9b8c7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9',
      timestamp: new Date(Date.now() - 10 * 60000).toLocaleString('en-GB', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      }).replace(/\//g, '-'),
      transactions: 32,
      miner: 'Peer-01',
      status: 'confirmed'
    },
  ]);

  const [stats, setStats] = useState({
    totalBlocks: 12543,
    totalTransactions: 302156,
    averageBlockTime: '5.2s',
    networkHashRate: '15.3 TH/s'
  });

  const [selectedBlock, setSelectedBlock] = useState(null);

  // Generate random hash
  const generateHash = () => {
    const chars = '0123456789abcdef';
    let hash = '0x';
    for (let i = 0; i < 64; i++) {
      hash += chars[Math.floor(Math.random() * chars.length)];
    }
    return hash;
  };

  // Generate random miner
  const getRandomMiner = () => {
    const miners = ['Peer-01', 'Peer-02', 'Peer-03', 'Peer-04', 'Peer-05'];
    return miners[Math.floor(Math.random() * miners.length)];
  };

  // Add new block every 10 seconds
  useEffect(() => {
    const blockInterval = setInterval(() => {
      setBlocks(prevBlocks => {
        const latestBlock = prevBlocks[0];
        const newTransactions = Math.floor(Math.random() * 30) + 10;
        
        // Generate new hash that's different from previous
        const newHash = generateHash();
        
        const newBlock = {
          id: latestBlock.id + 1,
          height: latestBlock.height + 1,
          hash: newHash,  // New unique hash for this block
          previousHash: latestBlock.hash,  // Points to previous block's hash
          timestamp: new Date().toLocaleString('en-GB', { 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit', 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
          }).replace(/\//g, '-'),
          transactions: newTransactions,
          miner: getRandomMiner(),
          status: 'confirmed'
        };

        // Keep only last 10 blocks
        const updatedBlocks = [newBlock, ...prevBlocks];
        
        // Update stats when new block is added
        setStats(prev => ({
          totalBlocks: prev.totalBlocks + 1,
          totalTransactions: prev.totalTransactions + newTransactions,
          averageBlockTime: (Math.random() * 2 + 4).toFixed(1) + 's',
          networkHashRate: (Math.random() * 5 + 13).toFixed(1) + ' TH/s'
        }));
        
        return updatedBlocks.slice(0, 10);
      });
    }, 10000); // New block every 10 seconds

    return () => clearInterval(blockInterval);
  }, []);

  // Update stats periodically (every 3 seconds)
  useEffect(() => {
    const statsInterval = setInterval(() => {
      setStats(prev => ({
        ...prev,
        averageBlockTime: (Math.random() * 2 + 4).toFixed(1) + 's',
        networkHashRate: (Math.random() * 5 + 13).toFixed(1) + ' TH/s'
      }));
    }, 3000);

    return () => clearInterval(statsInterval);
  }, []);

  const viewBlockDetails = (block) => {
    setSelectedBlock(block);
  };

  const closeModal = () => {
    setSelectedBlock(null);
  };

  const handleSync = () => {
    // Add a new block immediately when sync is clicked
    setBlocks(prevBlocks => {
      const latestBlock = prevBlocks[0];
      const newBlock = {
        id: latestBlock.id + 1,
        height: latestBlock.height + 1,
        hash: generateHash(),
        previousHash: latestBlock.hash,
        timestamp: new Date().toLocaleString('en-GB', { 
          year: 'numeric', 
          month: '2-digit', 
          day: '2-digit', 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit' 
        }).replace(/\//g, '-'),
        transactions: Math.floor(Math.random() * 30) + 10,
        miner: getRandomMiner(),
        status: 'confirmed'
      };
      return [newBlock, ...prevBlocks].slice(0, 10);
    });

    setStats(prev => ({
      totalBlocks: prev.totalBlocks + 1,
      totalTransactions: prev.totalTransactions + Math.floor(Math.random() * 30) + 10,
      averageBlockTime: (Math.random() * 2 + 4).toFixed(1) + 's',
      networkHashRate: (Math.random() * 5 + 13).toFixed(1) + ' TH/s'
    }));
  };

  return (
    <Layout>
      <div className="blockchain-container">
        {/* Page Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Blockchain Explorer</h1>
            <p className="page-subtitle">View and verify blockchain transactions</p>
          </div>
          <button className="sync-button" onClick={handleSync}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Sync Network
          </button>
        </div>

        {/* Blockchain Stats */}
        <div className="blockchain-stats-grid">
          <div className="stat-card-blockchain">
            <div className="stat-icon-blockchain" style={{ background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div className="stat-content-blockchain">
              <div className="stat-value-blockchain">{stats.totalBlocks.toLocaleString()}</div>
              <div className="stat-label-blockchain">Total Blocks</div>
            </div>
          </div>

          <div className="stat-card-blockchain">
            <div className="stat-icon-blockchain" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="stat-content-blockchain">
              <div className="stat-value-blockchain">{stats.totalTransactions.toLocaleString()}</div>
              <div className="stat-label-blockchain">Transactions</div>
            </div>
          </div>

          <div className="stat-card-blockchain">
            <div className="stat-icon-blockchain" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="stat-content-blockchain">
              <div className="stat-value-blockchain">{stats.averageBlockTime}</div>
              <div className="stat-label-blockchain">Avg Block Time</div>
            </div>
          </div>

          <div className="stat-card-blockchain">
            <div className="stat-icon-blockchain" style={{ background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="stat-content-blockchain">
              <div className="stat-value-blockchain">{stats.networkHashRate}</div>
              <div className="stat-label-blockchain">Hash Rate</div>
            </div>
          </div>
        </div>

        {/* Recent Blocks */}
        <div className="blocks-section">
          <div className="section-header">
            <h2 className="section-title">Recent Blocks</h2>
            <div className="live-indicator">
              <span className="pulse-dot"></span>
              Live
            </div>
          </div>

          <div className="blocks-list">
            {blocks.map((block) => (
              <div key={block.id} className="block-card">
                <div className="block-header">
                  <div className="block-height">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                    </svg>
                    Block #{block.height}
                  </div>
                  <span className="block-status confirmed">
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Confirmed
                  </span>
                </div>

                <div className="block-info-grid">
                  <div className="info-item">
                    <div className="info-label">Hash</div>
                    <code className="info-value hash-value">{block.hash.substring(0, 20)}...</code>
                  </div>
                  <div className="info-item">
                    <div className="info-label">Previous Hash</div>
                    <code className="info-value hash-value">{block.previousHash.substring(0, 20)}...</code>
                  </div>
                  <div className="info-item">
                    <div className="info-label">Timestamp</div>
                    <div className="info-value">{block.timestamp}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">Transactions</div>
                    <div className="info-value">{block.transactions} txns</div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">Mined By</div>
                    <div className="info-value">{block.miner}</div>
                  </div>
                </div>

                <button 
                  className="view-details-button"
                  onClick={() => viewBlockDetails(block)}
                >
                  View Full Details
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Block Details Modal */}
        {selectedBlock && (
          <div className="modal-overlay" onClick={closeModal}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Block Details - #{selectedBlock.height}</h2>
                <button className="modal-close" onClick={closeModal}>
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              <div className="modal-body">
                <div className="detail-row">
                  <span className="detail-label">Block Height:</span>
                  <span className="detail-value">{selectedBlock.height}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Hash:</span>
                  <code className="detail-value hash-value-full">{selectedBlock.hash}</code>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Previous Hash:</span>
                  <code className="detail-value hash-value-full">{selectedBlock.previousHash}</code>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Timestamp:</span>
                  <span className="detail-value">{selectedBlock.timestamp}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Transactions:</span>
                  <span className="detail-value">{selectedBlock.transactions} transactions</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Mined By:</span>
                  <span className="detail-value">{selectedBlock.miner}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Status:</span>
                  <span className="status-badge confirmed">✓ Confirmed</span>
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