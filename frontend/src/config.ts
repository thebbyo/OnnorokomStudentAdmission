const FALLBACK_API = 'http://localhost:8080';

/** Backend base URL from runtime config.js (set by the container from API_BASE_URL). */
export function apiBaseUrl(): string {
  const configured = typeof window !== 'undefined' ? window.__CONFIG__?.API_BASE_URL : undefined;
  return (configured && configured.trim() ? configured.trim() : FALLBACK_API).replace(/\/+$/, '');
}
