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

test('a 401 from /auth/login does NOT trigger a refresh (surfaces the real error)', async () => {
  let refreshCalled = false;
  server.use(
    http.post(`${API}/auth/login`, () => HttpResponse.json({ error: { message: 'Invalid credentials', code: 'UNAUTHORIZED' } }, { status: 401 })),
    http.post(`${API}/auth/refresh`, () => { refreshCalled = true; return HttpResponse.json({ accessToken: 'fresh' }); }),
  );
  await expect(api.post('/auth/login', { email: 'a', password: 'b' })).rejects.toMatchObject({
    response: { data: { error: { message: 'Invalid credentials' } } },
  });
  expect(refreshCalled).toBe(false);
});

test('concurrent 401s share a single refresh call (no duplicate rotation)', async () => {
  let refreshCount = 0;
  setAccessToken('expired');
  const ok = ({ request }) => (request.headers.get('authorization') === 'Bearer fresh'
    ? HttpResponse.json({ ok: true })
    : HttpResponse.json({ error: { message: 'x', code: 'UNAUTHORIZED' } }, { status: 401 }));
  server.use(
    http.get(`${API}/widget-a`, ok),
    http.get(`${API}/widget-b`, ok),
    http.post(`${API}/auth/refresh`, () => { refreshCount += 1; return HttpResponse.json({ accessToken: 'fresh' }); }),
  );
  const [a, b] = await Promise.all([api.get('/widget-a'), api.get('/widget-b')]);
  expect(a.data).toEqual({ ok: true });
  expect(b.data).toEqual({ ok: true });
  expect(refreshCount).toBe(1);
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
