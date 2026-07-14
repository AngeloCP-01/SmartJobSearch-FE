import { afterEach, expect, test, vi } from 'vitest';

const initMock = vi.fn();
const captureMock = vi.fn();
vi.mock('@sentry/react', () => ({ init: initMock, captureException: captureMock }));

afterEach(() => {
  initMock.mockReset();
  captureMock.mockReset();
  vi.unstubAllEnvs();
  vi.resetModules();
});

test('initSentry is a no-op when VITE_SENTRY_DSN is unset', async () => {
  vi.stubEnv('VITE_SENTRY_DSN', '');
  const { initSentry, captureError } = await import('./sentry');
  initSentry();
  captureError(new Error('x'));
  expect(initMock).not.toHaveBeenCalled();
  expect(captureMock).not.toHaveBeenCalled();
});

test('initSentry configures dsn + environment; captureError forwards', async () => {
  vi.stubEnv('VITE_SENTRY_DSN', 'https://k@o.ingest.sentry.io/1');
  vi.stubEnv('MODE', 'production');
  const { initSentry, captureError } = await import('./sentry');
  initSentry();
  expect(initMock).toHaveBeenCalledTimes(1);
  const opts = initMock.mock.calls[0][0];
  expect(opts).toMatchObject({
    dsn: 'https://k@o.ingest.sentry.io/1',
    environment: 'production',
    tracesSampleRate: 0,
    sendDefaultPii: false,
  });
  expect(opts.release).toBeUndefined(); // plugin injects it
  const err = new Error('x');
  captureError(err);
  expect(captureMock).toHaveBeenCalledWith(err);
});

test('scrub removes the Authorization header, keeps others', async () => {
  const { scrub } = await import('./sentry');
  const ev = scrub({ request: { headers: { Authorization: 'Bearer x', authorization: 'Bearer x', 'X-Foo': '1' } } });
  expect(ev.request.headers.Authorization).toBeUndefined();
  expect(ev.request.headers.authorization).toBeUndefined();
  expect(ev.request.headers['X-Foo']).toBe('1');
});
