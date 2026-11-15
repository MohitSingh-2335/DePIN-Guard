import { getStoredToken } from './sessionAuth';

const BACKEND_URL = (import.meta.env.VITE_API_URL || 'https://depin-guard-backend-nsvs.onrender.com').trim().replace(/\/$/, '');
const API_KEY     = (import.meta.env.VITE_API_KEY  || 'ee89a0f2fe93d5479b8891461e3f0cc45b0e4101ff8615b9d53e134925ba4af2').trim();

/**
 * Authenticated fetch wrapper
 * Automatically includes JWT token and API key headers
 * Handles 401 auth errors by clearing session and redirecting to login
 */
export const authenticatedFetch = async (path, options = {}) => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const url = path.startsWith('http') ? path : `${BACKEND_URL}${cleanPath}`;

  const token = getStoredToken();

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (API_KEY) {
    headers['X-API-Key'] = API_KEY;
  } else {
    console.warn('[API] No API key configured in VITE_API_KEY');
  }

  if (token && token !== 'null') {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, { ...options, headers });

    // Handle authentication errors
    if (response.status === 401) {
      console.warn('[API] Unauthorized (401) - clearing session');
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

export const apiGet  = (path)       => authenticatedFetch(path);
export const apiPost = (path, body) => authenticatedFetch(path, {
  method: 'POST',
  body: JSON.stringify(body),
});

export { BACKEND_URL };