import axios from 'axios';
import { put as blobPut } from '@vercel/blob/client';
import { API_URL } from '../config/env';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // Send httpOnly cookies
  headers: { 'Content-Type': 'application/json' },
});

// ── In-Memory Token Management ──────────────────────────
let accessToken = null;
let isRefreshing = false;
let failedQueue = [];

export const setAccessToken = (token) => { accessToken = token; };
export const getAccessToken = () => accessToken;
export const clearAccessToken = () => { accessToken = null; };

const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  failedQueue = [];
};

// ── Request Interceptor: Attach Token ───────────────────
api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// ── Direct-to-Blob Uploads ──────────────────────────────
// In production the API runs on Vercel, which rejects requests over 4.5 MB. When the server
// reports "blob" mode, every File inside an outgoing FormData is first uploaded straight to
// Vercel Blob (with a one-file token from /uploads/token) and replaced by a small reference
// in the "__blobUploads" field. The receiving endpoint treats it exactly like an uploaded file,
// so no upload screen needs to know about this.
let uploadModePromise = null;
const getUploadMode = () => {
  if (!uploadModePromise) {
    uploadModePromise = api.get('/uploads/config')
      .then((r) => r.data?.data?.mode || 'local')
      .catch(() => { uploadModePromise = null; return 'local'; });
  }
  return uploadModePromise;
};

api.interceptors.request.use(async (config) => {
  const body = config.data;
  if (!(body instanceof FormData)) return config;
  const entries = [...body.entries()];
  if (!entries.some(([, v]) => v instanceof File)) return config;
  if ((await getUploadMode()) !== 'blob') return config;

  const forwarded = new FormData();
  const refs = [];
  for (const [field, value] of entries) {
    if (!(value instanceof File)) {
      forwarded.append(field, value);
      continue;
    }
    const { data } = await api.post('/uploads/token', { name: value.name, size: value.size, type: value.type });
    const { pathname, clientToken } = data.data;
    const uploaded = await blobPut(pathname, value, {
      access: 'public',
      token: clientToken,
      contentType: value.type || undefined,
      multipart: value.size > 8 * 1024 * 1024,
    });
    refs.push({ field, pathname: uploaded.pathname, name: value.name, type: value.type });
  }
  forwarded.append('__blobUploads', JSON.stringify(refs));
  config.data = forwarded;
  return config;
});

// ── Response Interceptor: Silent Refresh on 401 ─────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only handle 401s; skip refresh endpoint and already-retried requests
    if (
      error.response?.status !== 401 ||
      originalRequest._retry ||
      originalRequest.url === '/auth/refresh'
    ) {
      return Promise.reject(error);
    }

    // If another request is already refreshing, queue this one
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const { data } = await api.post('/auth/refresh');
      accessToken = data.accessToken;
      processQueue(null, accessToken);

      // Retry original request with new token
      originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      accessToken = null;
      // Only redirect if we're not already on login
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
