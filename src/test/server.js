import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

export const API = 'http://localhost:4000/api';

// Minimal default handlers; individual tests override with server.use(...).
export const handlers = [
  http.post(`${API}/auth/refresh`, () =>
    HttpResponse.json({ error: { message: 'no session', code: 'UNAUTHORIZED' } }, { status: 401 })),
  http.get(`${API}/auth/me`, () =>
    HttpResponse.json({ error: { message: 'unauth', code: 'UNAUTHORIZED' } }, { status: 401 })),
];

export const server = setupServer(...handlers);
