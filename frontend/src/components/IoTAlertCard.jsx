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
  pressure = 0,
  recommendations = [],
  timestamp = null,
}) => {
  const alertConfig = {
    normal: {
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      ),
      borderColor: '#10b981',
      badgeClass: 'badge-normal',
      badgeText: 'NORMAL',
      instruction: 'Continue normal operation. No action needed.',
    },
    warning: {
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      ),
      borderColor: '#f59e0b',
      badgeClass: 'badge-warning',
      badgeText: 'WARNING',
      instruction: 'Monitor closely. Check sensor telemetry if trend continues.',
    },
    critical: {
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
      ),
      borderColor: '#ef4444',
      badgeClass: 'badge-danger',
      badgeText: 'CRITICAL',
      instruction: 'IMMEDIATE ACTION REQUIRED. Inspect machine and alert maintenance.',
    },
  };

  const config = alertConfig[alert_level] || alertConfig.normal;

  const categorizeReading = (label, value, unit, normalRange) => {
    const { min, max } = normalRange;
    const num = Number(value);
    const concerning = isNaN(num) || num < min || num > max;
    return {
      category: concerning ? 'concerning' : 'normal',
      indicator: concerning ? '!' : '✓',
      label,
      value: isNaN(num) ? value : num.toFixed(2),
      unit,
    };
  };

  const getStatusForMetric = (metric, value) => {
    const ranges = {
      temperature: { min: 20.5, max: 25.0, unit: '°C' },
      vibration: { min: 0.0, max: 3.10, unit: 'mm/s' },
      power_usage: { min: 0.0, max: 4.90, unit: 'kW' },
      pressure: { min: 30.0, max: 185.0, unit: 'bar' },
    };
    const rangeConfig = ranges[metric] || { min: 0, max: 100, unit: '' };
    return categorizeReading(metric, value, rangeConfig.unit, rangeConfig);
  };

  const readings = [
    getStatusForMetric('temperature', temperature),
    getStatusForMetric('vibration', vibration),
    getStatusForMetric('power_usage', power_usage),
    getStatusForMetric('pressure', pressure),
  ];

  return (
    <div
      className={`iot-alert-card iot-alert-card--${alert_level}`}
      style={{ borderLeftColor: config.borderColor }}
    >
      {/* Header */}
      <div className="iot-header">
        <div className="iot-title-section">
          <span className="iot-icon">{config.icon}</span>
          <div className="iot-machine-info">
            <h3 className="iot-machine-name">{machine_name}</h3>
            <p className="iot-device-id">{device_id}</p>
          </div>
        </div>
        <span className={`status-badge ${config.badgeClass}`}>
          {config.badgeText}
        </span>
      </div>

      {/* Status */}
      <div className="iot-status-section">
        <p className="iot-status-text">{status_short}</p>
        <p className="iot-instruction">{config.instruction}</p>
      </div>

      {/* Readings - 2x2 Grid */}
      <div className="iot-readings-grid">
        {readings.map((reading) => (
          <div
            key={reading.label}
            className={`iot-reading-card iot-reading-card--${reading.category}`}
          >
            <div className="iot-reading-indicator">{reading.indicator}</div>
            <p className="iot-reading-label">{reading.label}</p>
            <p className="iot-reading-value">
              {reading.value}
              <span className="iot-reading-unit">{reading.unit}</span>
            </p>
            <span
              className={`status-badge ${
                reading.category === 'normal' ? 'badge-normal' : 'badge-warning'
              }`}
            >
              {reading.category}
            </span>
          </div>
        ))}
      </div>

      {/* Recommendations - Only render when alert_level !== 'normal' */}
      {alert_level !== 'normal' && recommendations && recommendations.length > 0 && (
        <div
          className="iot-recommendations"
          style={{ borderLeftColor: config.borderColor }}
        >
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