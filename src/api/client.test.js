import { http, HttpResponse } from 'msw';
import { server, API } from '../test/server';
import api from './client';
import { setAccessToken, getAccessToken } from './authToken';

test('attaches the bearer token when set', async () => {
  let seenAuth = null;
  server.use(http.get(`${API}/widget`, ({ request }) => {
    seenAuth = request.headers.get('authorization');
    return HttpResponse.json({ ok: true });
  }));
  setAccessToken('abc');
  await api.get('/widget');
  expect(seenAuth).toBe('Bearer abc');
});

test('on 401 it refreshes once and retries the original request', async () => {
  let calls = 0;
  server.use(
    http.get(`${API}/widget`, () => {
      calls += 1;
      if (calls === 1) return HttpResponse.json({ error: { message: 'x', code: 'UNAUTHORIZED' } }, { status: 401 });
      return HttpResponse.json({ ok: true });
    }),
    http.post(`${API}/auth/refresh`, () => HttpResponse.json({ accessToken: 'fresh' })),
  );
  const res = await api.get('/widget');
  expect(res.data).toEqual({ ok: true });
  expect(getAccessToken()).toBe('fresh');
  expect(calls).toBe(2);
});

test('when refresh fails it clears the token and rejects', async () => {
  setAccessToken('stale');
  server.use(
    http.get(`${API}/widget`, () => HttpResponse.json({ error: { message: 'x', code: 'UNAUTHORIZED' } }, { status: 401 })),
    http.post(`${API}/auth/refresh`, () => HttpResponse.json({ error: { message: 'x', code: 'UNAUTHORIZED' } }, { status: 401 })),
  );
  await expect(api.get('/widget')).rejects.toBeTruthy();
  expect(getAccessToken()).toBeNull();
});
