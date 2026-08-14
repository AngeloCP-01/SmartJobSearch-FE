import { http, HttpResponse } from 'msw';
import { server, API, API_V2 } from '../test/server';
import api, { apiV2, toV2Base } from './client';
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

test('when refresh returns 401 it clears the token and rejects', async () => {
  setAccessToken('stale');
  server.use(
    http.get(`${API}/widget`, () => HttpResponse.json({ error: { message: 'x', code: 'UNAUTHORIZED' } }, { status: 401 })),
    http.post(`${API}/auth/refresh`, () => HttpResponse.json({ error: { message: 'x', code: 'UNAUTHORIZED' } }, { status: 401 })),
  );
  await expect(api.get('/widget')).rejects.toBeTruthy();
  expect(getAccessToken()).toBeNull();
});

test('a server outage during refresh does NOT log out (only a real 401 does)', async () => {
  setAccessToken('stale');
  server.use(
    http.get(`${API}/widget`, () => HttpResponse.json({ error: { message: 'x', code: 'UNAUTHORIZED' } }, { status: 401 })),
    // 503 = server down / restarting — not an invalid session.
    http.post(`${API}/auth/refresh`, () => HttpResponse.json({ error: { message: 'down' } }, { status: 503 })),
  );
  await expect(api.get('/widget')).rejects.toBeTruthy();
  expect(getAccessToken()).toBe('stale');
});

test('toV2Base rewrites the versioned base and the bare /api alias alike', () => {
  // VITE_API_URL is '/api/v1' in CI and prod but the bare '/api' alias in the
  // local .env, so v2 has to be derived by rewriting whichever suffix is there.
  expect(toV2Base('http://localhost:4000/api/v1')).toBe('http://localhost:4000/api/v2');
  expect(toV2Base('http://localhost:4000/api')).toBe('http://localhost:4000/api/v2');
  expect(toV2Base('https://smartjobsearch-api.onrender.com/api/')).toBe('https://smartjobsearch-api.onrender.com/api/v2');
  expect(toV2Base('http://localhost:4000/api/v2')).toBe('http://localhost:4000/api/v2');
});

test('the v2 client sends the bearer token and shares the v1 single-flight refresh', async () => {
  // Two instances with two refresh promises is the same rotation race the
  // single-flight guard exists to prevent — it must be shared, not duplicated.
  let refreshCount = 0;
  setAccessToken('expired');
  const ok = ({ request }) => (request.headers.get('authorization') === 'Bearer fresh'
    ? HttpResponse.json({ ok: true })
    : HttpResponse.json({ error: { message: 'x', code: 'UNAUTHORIZED' } }, { status: 401 }));
  server.use(
    http.get(`${API}/widget-a`, ok),
    http.get(`${API_V2}/widget-b`, ok),
    http.post(`${API}/auth/refresh`, () => { refreshCount += 1; return HttpResponse.json({ accessToken: 'fresh' }); }),
  );
  const [a, b] = await Promise.all([api.get('/widget-a'), apiV2.get('/widget-b')]);
  expect(a.data).toEqual({ ok: true });
  expect(b.data).toEqual({ ok: true });
  expect(refreshCount).toBe(1);
});
