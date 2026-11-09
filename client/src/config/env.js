/**
 * Deployment addresses — single source of truth for the admin panel.
 * Set in the hosting dashboard (Vercel → Environment Variables) for production;
 * the localhost fallbacks are for local development.
 *
 *   VITE_API_URL         Express API incl. /api      e.g. https://api.alaynaas.com/api
 *   VITE_STOREFRONT_URL  Public website               e.g. https://www.alaynaas.com
 */
export const API_URL = String(import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');

/** Origin of the API server (it also serves /uploads/*, redirecting to Blob storage in production) */
export const API_ORIGIN = API_URL.replace(/\/api$/, '');

/** Origin of the storefront website (serves /images/* and the public pages) */
export const STOREFRONT_ORIGIN = String(import.meta.env.VITE_STOREFRONT_URL || 'http://localhost:3001').replace(/\/+$/, '');

/**
 * Turn a stored asset reference into a URL the browser can load:
 *   absolute URLs (https://…, data:, blob:) are kept,
 *   /images/… lives on the storefront, anything else (/uploads/…) on the API.
 */
export function assetUrl(u) {
  if (!u || typeof u !== 'string') return u;
  if (/^(https?:|data:|blob:)/i.test(u)) return u;
  if (u.startsWith('/images/')) return `${STOREFRONT_ORIGIN}${u}`;
  return `${API_ORIGIN}${u.startsWith('/') ? '' : '/'}${u}`;
}
