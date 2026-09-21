const trimTrailingSlash = (value = '') => String(value || '').trim().replace(/\/+$/, '');

const configuredApiBase = import.meta.env.VITE_API_BASE_URL
  || (import.meta.env.VITE_API_URL ? trimTrailingSlash(import.meta.env.VITE_API_URL).replace(/\/api$/, '') : '');

export const API_BASE_URL = trimTrailingSlash(configuredApiBase) || 'http://127.0.0.1:8000';
export const API_URL = `${API_BASE_URL}/api`;
