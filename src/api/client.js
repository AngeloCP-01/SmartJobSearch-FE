import axios from 'axios';
import { getAccessToken, setAccessToken, emitUnauthorized } from './authToken';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Single-flight refresh: when several requests 401 at once, they must share ONE
// /auth/refresh call. Firing one per request races the backend's token rotation
// (the losers hit "token already rotated" and get logged out / 500'd).
let refreshPromise = null;
function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = api.post('/auth/refresh')
      .then(({ data }) => { setAccessToken(data.accessToken); return data.accessToken; })
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    // A 401 from these endpoints means "bad credentials / no session", not an
    // expired access token — refreshing would mask the real error.
    const noRefresh = ['/auth/login', '/auth/register', '/auth/refresh'];
    const skipRefresh = noRefresh.some((p) => original?.url?.includes(p));
    if (status === 401 && !skipRefresh && original && !original._retried) {
      original._retried = true;
      try {
        const accessToken = await refreshSession();
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch (refreshErr) {
        setAccessToken(null);
        emitUnauthorized();
        return Promise.reject(refreshErr);
      }
    }
    return Promise.reject(error);
  },
);

export default api;
