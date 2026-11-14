import React from 'react';
import './CompactDeviceStatus.css';

/**
 * CompactDeviceStatus Component
 * Shows device status in a more compact and professional format
 * Ideal for dashboards that need to fit multiple devices
 */
const CompactDeviceStatus = ({
  device_id = 'Device-000',
  machine_name = 'Unknown',
  alert_level = 'normal',
  status_short = 'Running normally',
  temperature = 0,
  vibration = 0,
  power_usage = 0,
  timestamp = null,
}) => {
  const getStatusConfig = (level) => {
    switch (level?.toLowerCase()) {
      case 'normal':
        return {
          icon: '',
          color: '#22c55e',
          bgColor: 'rgba(34, 197, 94, 0.1)',
          label: 'NORMAL',
        };
      case 'warning':
        return {
          icon: '',
          color: '#f59e0b',
          bgColor: 'rgba(245, 158, 11, 0.1)',
          label: 'WARNING',
        };
      case 'critical':
        return {
          icon: '',
          color: '#ef4444',
          bgColor: 'rgba(239, 68, 68, 0.1)',
          label: 'CRITICAL',
        };
      default:
        return {
          icon: '',
          color: '#6b7280',
          bgColor: 'rgba(107, 114, 128, 0.1)',
          label: 'UNKNOWN',
        };
    }
  };

  const config = getStatusConfig(alert_level);

  const formatTime = (ts) => {
    if (!ts) return '—';
    try {
      return new Date(ts).toLocaleTimeString();
    } catch {
      return '—';
    }
  };

  // Determine if readings are within normal range
  const isTemperatureOk = temperature >= 20 && temperature <= 85;
  const isVibrationOk = vibration >= 0 && vibration <= 10;
  const isPowerOk = power_usage >= 10 && power_usage <= 150;

  return (
    <div className="compact-device-status" style={{ borderLeftColor: config.color }}>
      {/* Header */}
      <div className="cds-header">
        <div className="cds-device-info">
          <span className="cds-device-id">{device_id}</span>
          <span className="cds-device-name">{machine_name}</span>
        </div>
        <div className="cds-status-badge" style={{ backgroundColor: config.bgColor, color: config.color }}>
          {config.label}
        </div>
      </div>

      {/* Status message */}
      <p className="cds-status-msg">{status_short}</p>

      {/* Metrics Grid */}
      <div className="cds-metrics">
        <div className={`cds-metric ${isTemperatureOk ? 'ok' : 'alert'}`}>
          <div className="cds-metric-label">Temperature</div>
          <div className="cds-metric-value">{temperature}°C</div>
          <div className="cds-metric-range">{isTemperatureOk ? '(Normal)' : '(Out of range)'}</div>
        </div>

        <div className={`cds-metric ${isVibrationOk ? 'ok' : 'alert'}`}>
          <div className="cds-metric-label">Vibration</div>
          <div className="cds-metric-value">{vibration.toFixed(1)} mm/s</div>
          <div className="cds-metric-range">{isVibrationOk ? '(Normal)' : '(Out of range)'}</div>
        </div>

        <div className={`cds-metric ${isPowerOk ? 'ok' : 'alert'}`}>
          <div className="cds-metric-label">Power</div>
          <div className="cds-metric-value">{power_usage.toFixed(1)} kW</div>
          <div className="cds-metric-range">{isPowerOk ? '(Normal)' : '(Out of range)'}</div>
        </div>

        <div className="cds-metric time">
          <div className="cds-metric-label">Last Update</div>
          <div className="cds-metric-value">{formatTime(timestamp)}</div>
        </div>
      </div>
    </div>
  );
};

export default CompactDeviceStatus;
