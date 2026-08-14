import axios from 'axios';
import { getAccessToken, setAccessToken, emitUnauthorized } from './authToken';

// Canonical API base is the versioned /api/v1; the backend also serves the
// unversioned /api as a backward-compatible alias.
const V1_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';

// VITE_API_URL is '/api/v1' in CI and prod but the bare '/api' alias in the
// local .env, so the v2 base is derived by rewriting whichever suffix is
// present rather than by concatenation. Exported so the MSW test server
// resolves the identical base instead of keeping a second copy of this rule.
export function toV2Base(base) {
  return base.replace(/\/api(\/v\d+)?\/?$/, '/api/v2');
}

function createClient(baseURL) {
  const instance = axios.create({ baseURL, withCredentials: true });
  instance.interceptors.request.use((config) => {
    const token = getAccessToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
  return instance;
}

const api = createClient(V1_BASE);

// /api/v2 is a complete surface — every non-list route behaves exactly as v1 —
// so a second instance is enough and call sites migrate one at a time.
export const apiV2 = createClient(toV2Base(V1_BASE));

// Single-flight refresh: when several requests 401 at once, they must share ONE
// /auth/refresh call. Firing one per request races the backend's token rotation
// (the losers hit "token already rotated" and get logged out / 500'd). The
// promise is module-level rather than per-instance so a v1 and a v2 request
// that 401 together still share it.
let refreshPromise = null;
function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = api.post('/auth/refresh')
      .then(({ data }) => { setAccessToken(data.accessToken); return data.accessToken; })
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

function attachRefresh(instance) {
  instance.interceptors.response.use(
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
          return instance(original);
        } catch (refreshErr) {
          // Only a real 401 means the session is invalid/expired → log out. A
          // network error or 5xx (server down/restarting) must NOT nuke the
          // session — just fail the request so it can be retried once it's back.
          if (refreshErr.response?.status === 401) {
            setAccessToken(null);
            emitUnauthorized();
          }
          return Promise.reject(refreshErr);
        }
      }
      return Promise.reject(error);
    },
  );
}

attachRefresh(api);
attachRefresh(apiV2);

export default api;
