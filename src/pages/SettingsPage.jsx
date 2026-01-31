import { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import './SettingsPage.css';

const SettingsPage = () => {
  const [settings, setSettings] = useState({
    // Profile
    fullName: 'Admin User',
    email: 'admin@iot.com',
    phone: '+91 98765 43210',
    
    // Notifications
    emailNotifications: true,
    smsNotifications: false,
    alertNotifications: true,
    
    // Device Settings
    autoRefresh: true,
    refreshInterval: '30',
    dataRetention: '90',
    
    // Theme
    theme: 'dark',
    language: 'en'
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [originalSettings, setOriginalSettings] = useState(settings);

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('iot-settings');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      setSettings(parsed);
      setOriginalSettings(parsed);
    }
  }, []);

  // Apply theme when settings change
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  // Track if settings have changed
  useEffect(() => {
    const changed = JSON.stringify(settings) !== JSON.stringify(originalSettings);
    setHasChanges(changed);
  }, [settings, originalSettings]);

  const handleChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    setSaveMessage(''); // Clear any previous save message
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage('');
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Save to localStorage
    localStorage.setItem('iot-settings', JSON.stringify(settings));
    setOriginalSettings(settings);
    
    setIsSaving(false);
    setSaveMessage('Settings saved successfully! ✓');
    setHasChanges(false);
    
    // Clear success message after 3 seconds
    setTimeout(() => {
      setSaveMessage('');
    }, 3000);
  };

  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset to default settings?')) {
      const defaultSettings = {
        fullName: 'Admin User',
        email: 'admin@iot.com',
        phone: '+91 98765 43210',
        emailNotifications: true,
        smsNotifications: false,
        alertNotifications: true,
        autoRefresh: true,
        refreshInterval: '30',
        dataRetention: '90',
        theme: 'dark',
        language: 'en'
      };
      
      setSettings(defaultSettings);
      localStorage.setItem('iot-settings', JSON.stringify(defaultSettings));
      setOriginalSettings(defaultSettings);
      setSaveMessage('Settings reset to defaults! ✓');
      
      setTimeout(() => {
        setSaveMessage('');
      }, 3000);
    }
  };

  const handleDeleteAccount = () => {
    if (window.confirm('⚠️ WARNING: This will permanently delete your account and all data. This action cannot be undone.\n\nType DELETE to confirm.')) {
      const confirmation = window.prompt('Type DELETE to confirm account deletion:');
      if (confirmation === 'DELETE') {
        // Clear all data
        localStorage.clear();
        alert('Account deleted successfully. You will be logged out.');
        // In a real app, this would redirect to login or homepage
        window.location.reload();
      } else {
        alert('Account deletion cancelled.');
      }
    }
  };

  const handleExportSettings = () => {
    const dataStr = JSON.stringify(settings, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `iot-settings-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    setSaveMessage('Settings exported! ✓');
    setTimeout(() => setSaveMessage(''), 3000);
  };

  const handleImportSettings = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const importedSettings = JSON.parse(event.target.result);
            setSettings(importedSettings);
            setSaveMessage('Settings imported! Click Save to apply. ⚠️');
          } catch (error) {
            alert('Error importing settings. Invalid file format.');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  return (
    <Layout>
      <div className="settings-container">
        {/* Page Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Settings</h1>
            <p className="page-subtitle">Manage your account and preferences</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {saveMessage && (
              <div style={{
                padding: '0.5rem 1rem',
                background: saveMessage.includes('⚠️') ? '#f59e0b20' : '#22c55e20',
                color: saveMessage.includes('⚠️') ? '#f59e0b' : '#22c55e',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '600'
              }}>
                {saveMessage}
              </div>
            )}
            <button 
              className={`save-button ${isSaving ? 'saving' : ''} ${!hasChanges ? 'disabled' : ''}`}
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              style={{
                opacity: hasChanges ? 1 : 0.5,
                cursor: hasChanges ? 'pointer' : 'not-allowed'
              }}
            >
              {isSaving ? (
                <>
                  <svg className="spinner" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.25"/>
                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" opacity="0.75"/>
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  {hasChanges ? 'Save Changes' : 'No Changes'}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{ 
          display: 'flex', 
          gap: '0.75rem', 
          marginBottom: '1.5rem',
          flexWrap: 'wrap'
        }}>
          <button 
            onClick={handleExportSettings}
            style={{
              padding: '0.5rem 1rem',
              background: '#0ea5e920',
              color: '#0ea5e9',
              border: '1px solid #0ea5e940',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: '1rem', height: '1rem' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export Settings
          </button>
          <button 
            onClick={handleImportSettings}
            style={{
              padding: '0.5rem 1rem',
              background: '#8b5cf620',
              color: '#8b5cf6',
              border: '1px solid #8b5cf640',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: '1rem', height: '1rem' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import Settings
          </button>
          <button 
            onClick={handleReset}
            style={{
              padding: '0.5rem 1rem',
              background: '#f59e0b20',
              color: '#f59e0b',
              border: '1px solid #f59e0b40',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: '1rem', height: '1rem' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reset to Defaults
          </button>
        </div>

        {/* Settings Sections */}
        <div className="settings-grid">
          {/* Profile Settings */}
          <div className="settings-card">
            <div className="card-header">
              <div className="card-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <h2 className="card-title">Profile Information</h2>
                <p className="card-subtitle">Update your personal details</p>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                type="text"
                value={settings.fullName}
                onChange={(e) => handleChange('fullName', e.target.value)}
                className="form-input"
                placeholder="Enter your full name"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                value={settings.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className="form-input"
                placeholder="your.email@example.com"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input
                type="tel"
                value={settings.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className="form-input"
                placeholder="+91 XXXXX XXXXX"
              />
            </div>
          </div>

          {/* Notification Settings */}
          <div className="settings-card">
            <div className="card-header">
              <div className="card-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <div>
                <h2 className="card-title">Notifications</h2>
                <p className="card-subtitle">Manage how you receive alerts</p>
              </div>
            </div>

            <div className="toggle-group">
              <div className="toggle-item">
                <div className="toggle-info">
                  <div className="toggle-label">Email Notifications</div>
                  <div className="toggle-description">Receive updates via email</div>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={settings.emailNotifications}
                    onChange={(e) => handleChange('emailNotifications', e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              <div className="toggle-item">
                <div className="toggle-info">
                  <div className="toggle-label">SMS Notifications</div>
                  <div className="toggle-description">Get text message alerts</div>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={settings.smsNotifications}
                    onChange={(e) => handleChange('smsNotifications', e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              <div className="toggle-item">
                <div className="toggle-info">
                  <div className="toggle-label">Alert Notifications</div>
                  <div className="toggle-description">Critical device alerts</div>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={settings.alertNotifications}
                    onChange={(e) => handleChange('alertNotifications', e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>
          </div>

          {/* Device Settings */}
          <div className="settings-card">
            <div className="card-header">
              <div className="card-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h2 className="card-title">Device Settings</h2>
                <p className="card-subtitle">Configure device behavior</p>
              </div>
            </div>

            <div className="toggle-group">
              <div className="toggle-item">
                <div className="toggle-info">
                  <div className="toggle-label">Auto Refresh</div>
                  <div className="toggle-description">Automatically update data</div>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={settings.autoRefresh}
                    onChange={(e) => handleChange('autoRefresh', e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                Refresh Interval (seconds)
                {!settings.autoRefresh && <span style={{ color: '#6b7280', marginLeft: '0.5rem' }}>(Disabled)</span>}
              </label>
              <select
                value={settings.refreshInterval}
                onChange={(e) => handleChange('refreshInterval', e.target.value)}
                className="form-select"
                disabled={!settings.autoRefresh}
                style={{ opacity: settings.autoRefresh ? 1 : 0.5 }}
              >
                <option value="10">10 seconds</option>
                <option value="30">30 seconds</option>
                <option value="60">1 minute</option>
                <option value="300">5 minutes</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Data Retention (days)</label>
              <select
                value={settings.dataRetention}
                onChange={(e) => handleChange('dataRetention', e.target.value)}
                className="form-select"
              >
                <option value="30">30 days</option>
                <option value="60">60 days</option>
                <option value="90">90 days</option>
                <option value="180">180 days</option>
                <option value="365">1 year</option>
              </select>
            </div>
          </div>

          {/* Appearance Settings */}
          <div className="settings-card">
            <div className="card-header">
              <div className="card-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
              </div>
              <div>
                <h2 className="card-title">Appearance</h2>
                <p className="card-subtitle">Customize your interface</p>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Theme</label>
              <select
                value={settings.theme}
                onChange={(e) => handleChange('theme', e.target.value)}
                className="form-select"
              >
                <option value="dark">🌙 Dark</option>
                <option value="light">☀️ Light</option>
                <option value="auto">🔄 Auto</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Language</label>
              <select
                value={settings.language}
                onChange={(e) => handleChange('language', e.target.value)}
                className="form-select"
              >
                <option value="en">🇬🇧 English</option>
                <option value="hi">🇮🇳 हिन्दी</option>
                <option value="es">🇪🇸 Español</option>
                <option value="fr">🇫🇷 Français</option>
              </select>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="danger-zone">
          <div className="danger-header">
            <h2 className="danger-title">⚠️ Danger Zone</h2>
            <p className="danger-subtitle">Irreversible actions - proceed with caution</p>
          </div>
          <div className="danger-actions">
            <button className="danger-button" onClick={handleDeleteAccount}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete Account & All Data
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default SettingsPage;