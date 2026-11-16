import { getStoredToken } from './sessionAuth';

const getAuthUrl = () => {
  const envUrl = (import.meta.env.VITE_AUTH_URL || import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');
  if (envUrl) return envUrl;
  if (typeof window !== 'undefined' && window.location.hostname && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')) {
    return 'https://depin-guard-backend-nsvs.onrender.com';
  }
  return '';
};

export const authFetch = async (path, options = {}) => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const authUrl = getAuthUrl();
  const url = path.startsWith('http') ? path : `${authUrl}${cleanPath}`;
  const token = getStoredToken();

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, { ...options, headers });
  return response;
};