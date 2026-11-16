import { getStoredToken } from './sessionAuth';

export const getBackendUrl = () => {
  const envUrl = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');
  if (envUrl) return envUrl;
  if (
    typeof window !== 'undefined' &&
    window.location.hostname &&
    !window.location.hostname.includes('localhost') &&
    !window.location.hostname.includes('127.0.0.1')
  ) {
    return 'https://depin-guard-backend-nsvs.onrender.com';
  }
  return '';
};

const BACKEND_URL = getBackendUrl();
const API_KEY = (import.meta.env.VITE_API_KEY || 'ee89a0f2fe93d5479b8891461e3f0cc45b0e4101ff8615b9d53e134925ba4af2').trim();

/**
 * Reads user-configured refresh interval from Settings (localStorage 'iot-settings').
 * Returns null if autoRefresh is disabled, or interval in milliseconds (default 6000ms).
 */
export const getRefreshIntervalMs = (defaultMs = 6000) => {
  try {
    const raw = localStorage.getItem('iot-settings');
    if (!raw) return defaultMs;
    const parsed = JSON.parse(raw);
    if (parsed.autoRefresh === false) return null;
    const sec = Number(parsed.refreshInterval);
    if (!isNaN(sec) && sec >= 5) {
      return sec * 1000;
    }
  } catch {
    // Ignore storage parse errors
  }
  return defaultMs;
};

/**
 * Parses backend UTC timestamps (including naive UTC strings) and formats in local time.
 */
export const formatUtcTimestamp = (timestamp, includeDate = true) => {
  if (!timestamp) return 'N/A';
  try {
    let s = String(timestamp).trim();
    if (s.endsWith(' UTC')) {
      s = s.replace(' UTC', 'Z').replace(' ', 'T');
    } else if (s.includes(' ') && !s.includes('+') && !s.endsWith('Z')) {
      s = s.replace(' ', 'T') + 'Z';
    } else if (s.includes('T') && !s.includes('+') && !s.endsWith('Z') && !/-\d{2}:\d{2}$/.test(s)) {
      s += 'Z';
    }
    const d = new Date(s);
    if (isNaN(d.getTime())) return String(timestamp);
    if (!includeDate) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    }
    return d.toLocaleString(undefined, {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch {
    return String(timestamp);
  }
};

export const authenticatedFetch = async (path, options = {}) => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const baseUrl = getBackendUrl();
  const url = path.startsWith('http') ? path : `${baseUrl}${cleanPath}`;

  const token = getStoredToken();

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (API_KEY) {
    headers['X-API-Key'] = API_KEY;
  }

  if (token && token !== 'null') {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
      localStorage.removeItem('isAuthenticated');
      window.location.href = '/login';
      return null;
    }

    return response;
  } catch (err) {
    console.error(`[authenticatedFetch] Failed to reach ${url}:`, err.message);
    throw err;
  }
};

export const apiGet = (path) => authenticatedFetch(path);
export const apiPost = (path, body) =>
  authenticatedFetch(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });

export { BACKEND_URL };