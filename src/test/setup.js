import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './server';
import { setAccessToken } from '../api/authToken';

// Recharts' ResponsiveContainer relies on ResizeObserver, absent in jsdom.
class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = global.ResizeObserver || ResizeObserver;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  setAccessToken(null); // reset in-memory auth between tests
});
afterAll(() => server.close());
