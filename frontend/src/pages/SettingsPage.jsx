import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import Layout from '../components/layout/Layout';
import { authFetch } from '../utils/authApi';
import { clearAuthStorage, storeUserProfile } from '../utils/sessionAuth';
import './SettingsPage.css';

/* ─────────────────────────────────────────
   Constants
───────────────────────────────────────── */
const NAV_GROUPS = [
  {
    group: 'Account',
    items: [
      { id: 'profile',       label: 'Profile',       icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
      { id: 'security',      label: 'Security',      icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
      { id: 'notifications', label: 'Notifications', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
    ],
  },
  {
    group: 'Preferences',
    items: [
      { id: 'appearance', label: 'Appearance', icon: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01' },
      { id: 'devices',    label: 'Devices',    icon: 'M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18' },
    ],
  },
];

const DEFAULT_SETTINGS = {
  fullName: '', email: '', phone: '', bio: '',
  emailNotifications: true,
  smsNotifications: false,
  alertNotifications: true,
  alertLevel: 'all',
  weeklyDigest: true,
  securityAlerts: true,
  autoRefresh: true,
  refreshInterval: '30',
  dataRetention: '90',
  theme: 'dark',
  language: 'en',
  density: 'comfortable',
};

/* ─────────────────────────────────────────
   Reusable small components
───────────────────────────────────────── */
const Toggle = ({ checked, onChange, disabled = false }) => (
  <label className={`sp-toggle${disabled ? ' sp-toggle--disabled' : ''}`}>
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={e => !disabled && onChange(e.target.checked)}
    />
    <span className="sp-toggle-track">
      <span className="sp-toggle-thumb" />
    </span>
  </label>
);

const Field = ({ label, hint, children }) => (
  <div className="sp-field">
    <label className="sp-field-label">
      {label}
      {hint && <span className="sp-field-hint">{hint}</span>}
    </label>
    {children}
  </div>
);

const Icon = ({ d }) => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={d} />
  </svg>
);

/* ─────────────────────────────────────────
   Main Page
───────────────────────────────────────── */
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile');
  const [settings, setSettings]   = useState(DEFAULT_SETTINGS);
  const [original, setOriginal]   = useState(null);
  const [isSaving, setIsSaving]   = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [pw, setPw]               = useState({ current: '', newPass: '', confirm: '', show: false });
  const [pwMsg, setPwMsg]         = useState(null);

  /* ── Load on mount ── */
  useEffect(() => {
    const load = async () => {
      const savedPrefs = (() => {
        try { return JSON.parse(localStorage.getItem('iot-settings') || '{}'); } catch { return {}; }
      })();
      const email = localStorage.getItem('userEmail') || '';
      const name  = localStorage.getItem('userName')  || '';

      let profileData = {};
      try {
        const res = await authFetch('/profile');
        if (res && res.ok) {
          const { profile = {} } = await res.json();
          profileData = profile;
          storeUserProfile(profile);
        }
      } catch { /* backend sleeping — use localStorage */ }

      const merged = {
        ...DEFAULT_SETTINGS,
        ...savedPrefs,
        fullName: profileData.full_name || savedPrefs.fullName || name || '',
        email:    profileData.email     || savedPrefs.email    || email || '',
        phone:    profileData.phone     || savedPrefs.phone    || '',
        bio:      profileData.bio       || savedPrefs.bio      || '',
      };

      setSettings(merged);
      setOriginal(merged);
      setIsLoading(false);
    };
    load();
  }, []);

  /* ── Theme: instant apply ── */
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'auto') {
      root.removeAttribute('data-theme');
      root.style.colorScheme = 'auto';
    } else {
      root.setAttribute('data-theme', settings.theme);
      root.style.colorScheme = settings.theme;
    }
  }, [settings.theme]);

  /* ── Density: instant apply ── */
  useEffect(() => {
    document.documentElement.setAttribute('data-density', settings.density);
  }, [settings.density]);

  const hasChanges = original !== null && JSON.stringify(settings) !== JSON.stringify(original);
  const set = useCallback((k, v) => setSettings(p => ({ ...p, [k]: v })), []);

  /* ── Save ── */
  const handleSave = async () => {
    setIsSaving(true);
    // Save locally first (always works)
    localStorage.setItem('iot-settings', JSON.stringify(settings));
    if (settings.fullName) localStorage.setItem('userName',  settings.fullName);
    if (settings.email)    localStorage.setItem('userEmail', settings.email);

    try {
      const res = await authFetch('/profile', {
        method: 'POST',
        body: JSON.stringify({
          full_name: settings.fullName,
          email:     settings.email,
          phone:     settings.phone,
          bio:       settings.bio,
        }),
      });
      if (!res.ok) throw new Error('Server error');
      const data = await res.json();
      storeUserProfile(data.profile || {});
      setOriginal({ ...settings });
      toast.success('Settings saved!');
    } catch {
      setOriginal({ ...settings });
      toast('Saved locally - sync when backend is online.');
    } finally {
      setIsSaving(false);
    }
  };

  /* ── Reset ── */
  const handleReset = () => {
    if (!window.confirm('Reset all settings to defaults?')) return;
    const def = {
      ...DEFAULT_SETTINGS,
      fullName: localStorage.getItem('userName')  || '',
      email:    localStorage.getItem('userEmail') || '',
    };
    setSettings(def);
    setOriginal(def);
    localStorage.setItem('iot-settings', JSON.stringify(def));
    toast.success('Reset to defaults');
  };

  /* ── Password ── */
  const handlePasswordChange = async () => {
    setPwMsg(null);
    if (!pw.current || !pw.newPass || !pw.confirm)
      return setPwMsg({ text: 'All fields are required.', type: 'error' });
    if (pw.newPass.length < 8)
      return setPwMsg({ text: 'Minimum 8 characters required.', type: 'error' });
    if (pw.newPass !== pw.confirm)
      return setPwMsg({ text: 'Passwords do not match.', type: 'error' });

    try {
      const res = await authFetch('/change-password', {
        method: 'POST',
        body: JSON.stringify({
          current_password: pw.current,
          new_password: pw.newPass,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to update password');
      }
      setPwMsg({ text: 'Password successfully updated!', type: 'success' });
      setPw({ current: '', newPass: '', confirm: '', show: false });
      toast.success('Password changed successfully!');
    } catch (err) {
      setPwMsg({ text: err.message || 'Error updating password', type: 'error' });
      toast.error(err.message || 'Password update failed');
    }
  };

  /* ── Delete account ── */
  const handleDeleteAccount = () => {
    if (!window.confirm('This will permanently delete your account. This CANNOT be undone.')) return;
    const typed = window.prompt('Type DELETE to confirm:');
    if (typed === 'DELETE') {
      clearAuthStorage();
      localStorage.clear();
      toast.success('Account deleted. Redirecting…');
      setTimeout(() => { window.location.href = '/login'; }, 1200);
    } else if (typed !== null) {
      toast.error('Incorrect — account NOT deleted.');
    }
  };

  /* ── Export / Import ── */
  const handleExport = () => {
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), {
      href: url,
      download: `depin-settings-${new Date().toISOString().split('T')[0]}.json`,
    });
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    toast.success('Settings exported!');
  };

  const handleImport = () => {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept: '.json' });
    input.onchange = e => {
      const file = e.target.files?.[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const parsed = JSON.parse(ev.target.result);
          setSettings(prev => ({ ...prev, ...parsed }));
          toast('Settings imported - click Save to apply.');
        } catch { toast.error('Invalid JSON file.'); }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  /* ── Initials ── */
  const initials = settings.fullName
    ? settings.fullName.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : (settings.email?.[0] || 'U').toUpperCase();

  /* ── Loading ── */
  if (isLoading) {
    return (
      <Layout>
        <div className="sp-loading">
          <div className="sp-loading-pulse" />
          <p>Loading settings…</p>
        </div>
      </Layout>
    );
  }

  /* ══════════════════════════════════════
     RENDER
  ══════════════════════════════════════ */
  return (
    <Layout>
      <div className="sp-root">

        {/* ── Sidebar ── */}
        <aside className="sp-sidebar">
          <div className="sp-sidebar-header">
            <div className="sp-avatar-lg">{initials}</div>
            <div className="sp-sidebar-name">{settings.fullName || 'User'}</div>
            <div className="sp-sidebar-email">{settings.email || '—'}</div>
          </div>

          <nav className="sp-nav">
            {NAV_GROUPS.map(({ group, items }) => (
              <div key={group}>
                <p className="sp-nav-label">{group}</p>
                {items.map(({ id, label, icon }) => (
                  <button
                    key={id}
                    className={`sp-nav-item${activeTab === id ? ' active' : ''}`}
                    onClick={() => setActiveTab(id)}
                  >
                    <Icon d={icon} />
                    {label}
                    {/* unsaved badge */}
                    {hasChanges && activeTab === id && (
                      <span className="sp-nav-dot" title="Unsaved changes" />
                    )}
                  </button>
                ))}
              </div>
            ))}

            <p className="sp-nav-label">Danger</p>
            <button className="sp-nav-item sp-nav-danger" onClick={handleDeleteAccount}>
              <Icon d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              Delete Account
            </button>
          </nav>
        </aside>

        {/* ── Main ── */}
        <main className="sp-main">

          {/* Topbar */}
          <div className="sp-topbar">
            <div>
              <h1 className="sp-page-title">
                {NAV_GROUPS.flatMap(g => g.items).find(n => n.id === activeTab)?.label ?? 'Settings'}
              </h1>
              <p className="sp-page-sub">Manage your account and preferences</p>
            </div>
            <div className="sp-topbar-actions">
              <button className="sp-btn-ghost" onClick={handleReset}>Reset defaults</button>
              <button
                className={`sp-btn-primary${(!hasChanges || isSaving) ? ' disabled' : ''}`}
                onClick={handleSave}
                disabled={!hasChanges || isSaving}
              >
                {isSaving
                  ? <><span className="sp-spinner" />Saving…</>
                  : hasChanges ? 'Save changes' : 'Saved'
                }
              </button>
            </div>
          </div>

          {/* ═══ PROFILE ═══ */}
          {activeTab === 'profile' && (
            <div className="sp-pane">
              <div className="sp-card">
                <div className="sp-card-head">
                  <h2>Personal information</h2>
                  <p>Your name and contact details</p>
                </div>
                <div className="sp-avatar-row">
                  <div className="sp-avatar-xl">{initials}</div>
                  <div>
                    <p className="sp-avatar-name">{settings.fullName || 'No name set'}</p>
                    <p className="sp-avatar-hint">PNG or JPG, max 2 MB</p>
                    <button className="sp-btn-ghost sp-btn-sm"
                      onClick={() => toast('Photo upload coming soon!')}>
                      Change photo
                    </button>
                  </div>
                </div>
                <div className="sp-fields-grid">
                  <Field label="Full name">
                    <input className="sp-input" value={settings.fullName}
                      onChange={e => set('fullName', e.target.value)}
                      placeholder="e.g. Mohit Singh" />
                  </Field>
                  <Field label="Email address">
                    <input className="sp-input" type="email" value={settings.email}
                      onChange={e => set('email', e.target.value)}
                      placeholder="you@example.com" />
                  </Field>
                  <Field label="Phone number">
                    <input className="sp-input" type="tel" value={settings.phone}
                      onChange={e => set('phone', e.target.value)}
                      placeholder="+91 XXXXX XXXXX" />
                  </Field>
                  <Field label="Language">
                    <select className="sp-select" value={settings.language}
                      onChange={e => set('language', e.target.value)}>
                      <option value="en">English</option>
                      <option value="hi">Hindi</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                    </select>
                  </Field>
                  <Field label="Bio" hint="optional">
                    <textarea className="sp-textarea" rows={3} value={settings.bio}
                      onChange={e => set('bio', e.target.value)}
                      placeholder="Short bio about your role…" />
                  </Field>
                </div>
              </div>
            </div>
          )}

          {/* ═══ SECURITY ═══ */}
          {activeTab === 'security' && (
            <div className="sp-pane">
              <div className="sp-card">
                <div className="sp-card-head">
                  <h2>Change password</h2>
                  <p>Use a strong password you don't use elsewhere</p>
                </div>
                <div className="sp-fields-grid sp-fields-single">
                  {[
                    { label: 'Current password',    key: 'current', ph: 'Enter current password' },
                    { label: 'New password',         key: 'newPass', ph: 'Minimum 8 characters'   },
                    { label: 'Confirm new password', key: 'confirm', ph: 'Re-enter new password'  },
                  ].map(({ label, key, ph }) => (
                    <Field key={key} label={label}>
                      <input
                        className="sp-input"
                        type={pw.show ? 'text' : 'password'}
                        value={pw[key]}
                        onChange={e => setPw(p => ({ ...p, [key]: e.target.value }))}
                        placeholder={ph}
                      />
                    </Field>
                  ))}
                  <label className="sp-checkbox-row">
                    <input type="checkbox" checked={pw.show}
                      onChange={e => setPw(p => ({ ...p, show: e.target.checked }))} />
                    Show passwords
                  </label>
                  {pwMsg && (
                    <div className={`sp-inline-msg sp-inline-msg--${pwMsg.type}`}>
                      {pwMsg.text}
                    </div>
                  )}
                  <button className="sp-btn-primary sp-btn-full" onClick={handlePasswordChange}>
                    Update password
                  </button>
                </div>
              </div>

              <div className="sp-card">
                <div className="sp-card-head">
                  <h2>Active sessions</h2>
                  <p>Devices currently signed in to your account</p>
                </div>
                {[
                  { device: 'Chrome on Windows', location: 'Mumbai, IN', time: 'Active now',  active: true  },
                  { device: 'Safari on iPhone',  location: 'Delhi, IN',  time: '2 days ago',  active: false },
                  { device: 'Firefox on macOS',  location: 'Pune, IN',   time: '5 days ago',  active: false },
                ].map((s, i) => (
                  <div key={i} className="sp-session-row">
                    <span className={`sp-session-dot${s.active ? '' : ' inactive'}`} />
                    <div className="sp-session-info">
                      <p>{s.device}</p>
                      <span>{s.location} · {s.time}</span>
                    </div>
                    {s.active
                      ? <span className="sp-badge-active">This device</span>
                      : <button className="sp-btn-ghost sp-btn-sm sp-btn-danger-ghost"
                          onClick={() => toast.success(`Session on ${s.device} revoked.`)}>
                          Revoke
                        </button>
                    }
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ NOTIFICATIONS ═══ */}
          {activeTab === 'notifications' && (
            <div className="sp-pane">
              <div className="sp-card">
                <div className="sp-card-head">
                  <h2>Notification channels</h2>
                  <p>Choose how you want to receive notifications</p>
                </div>
                {[
                  { label: 'Email notifications', desc: 'Summaries and updates via email',           field: 'emailNotifications' },
                  { label: 'SMS notifications',   desc: 'Text message alerts to your phone',          field: 'smsNotifications'   },
                  { label: 'Weekly digest',        desc: 'Activity summary sent every Monday',         field: 'weeklyDigest'       },
                  { label: 'Security alerts',      desc: 'Login attempts and access notifications',    field: 'securityAlerts'     },
                ].map(({ label, desc, field }) => (
                  <div key={field} className="sp-toggle-row">
                    <div>
                      <p className="sp-toggle-label">{label}</p>
                      <p className="sp-toggle-desc">{desc}</p>
                    </div>
                    <Toggle
                      checked={settings[field]}
                      onChange={v => {
                        set(field, v);
                        toast(v ? `${label} enabled` : `${label} disabled`);
                      }}
                    />
                  </div>
                ))}
              </div>

              <div className="sp-card">
                <div className="sp-card-head">
                  <h2>Alert level</h2>
                  <p>Control which device alerts you receive</p>
                </div>
                <div className="sp-alert-level-group">
                  {[
                    { value: 'all',  label: 'All alerts',  desc: 'Low, medium, and high severity' },
                    { value: 'high', label: 'High only',   desc: 'Only critical alerts'            },
                    { value: 'none', label: 'No alerts',   desc: 'Mute all device alerts'          },
                  ].map(opt => (
                    <label
                      key={opt.value}
                      className={`sp-radio-card${settings.alertLevel === opt.value ? ' active' : ''}`}
                    >
                      <input
                        type="radio"
                        name="alertLevel"
                        value={opt.value}
                        checked={settings.alertLevel === opt.value}
                        onChange={() => {
                          set('alertLevel', opt.value);
                          toast(`Alert level: ${opt.label}`);
                        }}
                      />
                      <div>
                        <p className="sp-radio-label">{opt.label}</p>
                        <span className="sp-radio-desc">{opt.desc}</span>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="sp-toggle-row sp-toggle-row--top-border">
                  <div>
                    <p className="sp-toggle-label">Device alert notifications</p>
                    <p className="sp-toggle-desc">Master switch for all device alerts</p>
                  </div>
                  <Toggle
                    checked={settings.alertNotifications}
                    onChange={v => {
                      set('alertNotifications', v);
                      toast(v ? 'Device alerts enabled' : 'Device alerts muted');
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ═══ APPEARANCE ═══ */}
          {activeTab === 'appearance' && (
            <div className="sp-pane">
              <div className="sp-card">
                <div className="sp-card-head">
                  <h2>Theme</h2>
                  <p>Applied instantly — no page reload needed</p>
                </div>
                <div className="sp-theme-grid">
                  {[
                    { value: 'dark',  label: 'Dark',   desc: 'Easy on the eyes' },
                    { value: 'light', label: 'Light',  desc: 'Clean and bright' },
                    { value: 'auto',  label: 'System', desc: 'Follows your OS' },
                  ].map(t => (
                    <button
                      key={t.value}
                      className={`sp-theme-option${settings.theme === t.value ? ' active' : ''}`}
                      onClick={() => {
                        set('theme', t.value);
                        toast(`Theme: ${t.label}`);
                      }}
                    >
                      <div className={`sp-theme-preview sp-theme-preview--${t.value}`} />
                      <p>{t.label}</p>
                      <span>{t.desc}</span>
                      {settings.theme === t.value && <span className="sp-theme-check">Active</span>}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sp-card">
                <div className="sp-card-head">
                  <h2>Interface density</h2>
                  <p>Controls spacing and padding across the dashboard</p>
                </div>
                <div className="sp-fields-grid sp-fields-single">
                  <Field label="Density">
                    <select className="sp-select" value={settings.density}
                      onChange={e => {
                        set('density', e.target.value);
                        toast(`Density: ${e.target.value}`);
                      }}>
                      <option value="comfortable">Comfortable</option>
                      <option value="compact">Compact</option>
                      <option value="spacious">Spacious</option>
                    </select>
                  </Field>
                </div>
              </div>
            </div>
          )}

          {/* ═══ DEVICES ═══ */}
          {activeTab === 'devices' && (
            <div className="sp-pane">
              <div className="sp-card">
                <div className="sp-card-head">
                  <h2>Data refresh</h2>
                  <p>Control how often device data is pulled</p>
                </div>
                <div className="sp-toggle-row">
                  <div>
                    <p className="sp-toggle-label">Auto refresh</p>
                    <p className="sp-toggle-desc">Automatically fetch latest device data</p>
                  </div>
                  <Toggle
                    checked={settings.autoRefresh}
                    onChange={v => {
                      set('autoRefresh', v);
                      toast(v ? 'Auto refresh enabled' : 'Auto refresh disabled');
                    }}
                  />
                </div>
                <div className="sp-fields-grid sp-fields-single" style={{ marginTop: '1.25rem' }}>
                  <Field label="Refresh interval" hint={!settings.autoRefresh ? '(auto refresh is off)' : ''}>
                    <select className="sp-select" value={settings.refreshInterval}
                      onChange={e => set('refreshInterval', e.target.value)}
                      disabled={!settings.autoRefresh}>
                      <option value="10">Every 10 seconds</option>
                      <option value="30">Every 30 seconds</option>
                      <option value="60">Every 1 minute</option>
                      <option value="300">Every 5 minutes</option>
                    </select>
                  </Field>
                  <Field label="Data retention">
                    <select className="sp-select" value={settings.dataRetention}
                      onChange={e => set('dataRetention', e.target.value)}>
                      <option value="30">30 days</option>
                      <option value="60">60 days</option>
                      <option value="90">90 days</option>
                      <option value="180">180 days</option>
                      <option value="365">1 year</option>
                    </select>
                  </Field>
                </div>
              </div>

              <div className="sp-card">
                <div className="sp-card-head">
                  <h2>Backup &amp; restore</h2>
                  <p>Export settings as JSON or restore from a backup</p>
                </div>
                <div className="sp-export-row">
                  <button className="sp-btn-ghost" onClick={handleExport}>
                    <Icon d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    Export settings
                  </button>
                  <button className="sp-btn-ghost" onClick={handleImport}>
                    <Icon d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    Import settings
                  </button>
                </div>
              </div>

              <div className="sp-card sp-card--danger">
                <div className="sp-card-head">
                  <h2 style={{ color: '#ef4444' }}>Danger zone</h2>
                  <p>Irreversible actions — proceed with caution</p>
                </div>
                <div className="sp-export-row">
                  <button className="sp-btn-danger"
                    onClick={() => {
                      if (window.confirm('Reset ALL device data? This cannot be undone.'))
                        toast.success('Device data reset.');
                    }}>
                    Reset device data
                  </button>
                  <button className="sp-btn-danger" onClick={handleDeleteAccount}>
                    Delete account
                  </button>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </Layout>
  );
}