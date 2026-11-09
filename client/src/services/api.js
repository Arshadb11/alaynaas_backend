import axios from 'axios';

const API_BASE = 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE,
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
