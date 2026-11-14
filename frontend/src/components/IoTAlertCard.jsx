import React from 'react';
import './IoTAlertCard.css';

const IoTAlertCard = ({
  device_id = 'Device-000',
  machine_name = 'Unknown Machine',
  alert_level = 'normal',
  status_short = 'Running normally',
  temperature = 0,
  vibration = 0,
  power_usage = 0,
  recommendations = [],
  timestamp = null,
}) => {
  const alertConfig = {
    normal: {
      icon: '[OK]',
      borderColor: '#10b981',
      badgeText: 'NORMAL',
      instruction: 'Continue normal operation. No action needed.',
    },
    warning: {
      icon: '[WARN]',
      borderColor: '#f59e0b',
      badgeText: 'WARNING',
      instruction: 'Monitor closely! Take corrective action if status worsens.',
    },
    critical: {
      icon: '[ALERT]',
      borderColor: '#ef4444',
      badgeText: 'CRITICAL',
      instruction: 'IMMEDIATE ACTION REQUIRED. Stop machine and alert maintenance.',
    },
  };

  const config = alertConfig[alert_level] || alertConfig.normal;

  const formatTime = (ts) => {
    if (!ts) return 'N/A';
    try { return new Date(ts).toLocaleTimeString(); }
    catch { return 'N/A'; }
  };

  const categorizeReading = (label, value, unit, normalRange) => {
    const { min, max } = normalRange;
    const concerning = value < min || value > max;
    return {
      category:  concerning ? 'concerning' : 'normal',
      indicator: concerning ? '!' : '-',
      label, value, unit,
    };
  };

  const getStatusForMetric = (metric, value) => {
    const ranges = {
      temperature: { min: 20, max: 85 },
      vibration:   { min: 0,  max: 10  },
      power_usage: { min: 10, max: 150 },
    };
    const units = { temperature: '°C', vibration: 'mm/s', power_usage: 'kW' };
    return categorizeReading(metric, value, units[metric], ranges[metric] || { min: 0, max: 100 });
  };

  const readings = [
    getStatusForMetric('temperature', temperature),
    getStatusForMetric('vibration',   vibration),
    getStatusForMetric('power_usage', power_usage),
  ];

  return (
    <div className={`iot-alert-card iot-alert-card--${alert_level}`}
         style={{ borderLeftColor: config.borderColor }}>

      {/* Header */}
      <div className="iot-header">
        <div className="iot-title-section">
          <span className="iot-icon">{config.icon}</span>
          <div className="iot-machine-info">
            <h3 className="iot-machine-name">{machine_name}</h3>
            <p className="iot-device-id">{device_id}</p>
          </div>
        </div>
        <span className="iot-badge" style={{ backgroundColor: config.borderColor }}>
          {config.badgeText}
        </span>
      </div>

      {/* Status */}
      <div className="iot-status-section">
        <p className="iot-status-text">{status_short}</p>
        <p className="iot-instruction">{config.instruction}</p>
      </div>

      {/* Readings */}
      <div className="iot-readings-grid">
        {readings.map((reading) => (
          <div key={reading.label}
               className={`iot-reading-card iot-reading-card--${reading.category}`}>
            <div className="iot-reading-indicator">{reading.indicator}</div>
            <p className="iot-reading-label">{reading.label}</p>
            <p className="iot-reading-value">
              {reading.value}
              <span className="iot-reading-unit">{reading.unit}</span>
            </p>
            <p className="iot-reading-status">{reading.category}</p>
          </div>
        ))}
      </div>

      {/* Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <div className="iot-recommendations"
             style={{ borderLeftColor: config.borderColor }}>
          <h4 className="iot-recommendations-title">Recommended Actions:</h4>
          <ol className="iot-recommendations-list">
            {recommendations.map((rec, idx) => (
              <li key={idx} className="iot-recommendation-item">{rec}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
};

export default IoTAlertCard;