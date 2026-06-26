import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

// Mirror the api client's base exactly (same env var + default) so MSW handlers
// match whatever base the client uses — /api locally (.env) or /api/v1 in CI.
export const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';

// Minimal default handlers; individual tests override with server.use(...).
export const handlers = [
  http.post(`${API}/auth/refresh`, () =>
    HttpResponse.json({ error: { message: 'no session', code: 'UNAUTHORIZED' } }, { status: 401 })),
  http.get(`${API}/auth/me`, () =>
    HttpResponse.json({ error: { message: 'unauth', code: 'UNAUTHORIZED' } }, { status: 401 })),
  http.get(`${API}/reminders`, () =>
    HttpResponse.json({
      interviews: { upcoming: [], overdue: [] },
      followUps: { due: [], upcoming: [] },
      counts: { total: 0, interviews: 0, followUps: 0 },
    })),
  http.get(`${API}/activity`, () =>
    HttpResponse.json({ items: [], nextCursor: null })),
  http.get(`${API}/analysis`, () => HttpResponse.json([])),
  http.get(`${API}/analysis/config`, () => HttpResponse.json({ aiAvailable: false })),
];

export const server = setupServer(...handlers);
