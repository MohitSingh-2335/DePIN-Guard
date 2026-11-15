import { getStoredToken } from './sessionAuth';

const AUTH_URL = (import.meta.env.VITE_AUTH_URL || import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');

export const authFetch = async (path, options = {}) => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const url = path.startsWith('http') ? path : `${AUTH_URL}${cleanPath}`;
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