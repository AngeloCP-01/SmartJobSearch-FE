import { afterEach, describe, expect, test, vi } from 'vitest';

const trackMock = vi.fn();
vi.mock('@vercel/analytics', () => ({ track: trackMock }));
vi.mock('@vercel/analytics/react', () => ({ Analytics: () => null }));
vi.mock('@vercel/speed-insights/react', () => ({ SpeedInsights: () => null }));

afterEach(() => {
  trackMock.mockReset();
  vi.resetModules();
});

describe('normalizeRoute', () => {
  test('collapses the /editor/:id document id to a pattern', async () => {
    const { normalizeRoute } = await import('./analytics');
    expect(normalizeRoute('/editor/abc123')).toBe('/editor/[id]');
    expect(normalizeRoute('/editor/6890f0c2e1d4a')).toBe('/editor/[id]');
  });

  test('leaves the bare /editor route alone', async () => {
    const { normalizeRoute } = await import('./analytics');
    expect(normalizeRoute('/editor')).toBe('/editor');
    expect(normalizeRoute('/editor/')).toBe('/editor');
  });

  test('leaves all non-parameterized routes unchanged', async () => {
    const { normalizeRoute } = await import('./analytics');
    for (const p of ['/', '/applications', '/analysis', '/welcome', '/documents']) {
      expect(normalizeRoute(p)).toBe(p);
    }
  });

  test('does not collapse deeper segments under /editor', async () => {
    const { normalizeRoute } = await import('./analytics');
    expect(normalizeRoute('/editor/abc/extra')).toBe('/editor/[id]/extra');
  });
});

describe('normalizeAnalyticsUrl', () => {
  test('rewrites the pathname but preserves origin and query', async () => {
    const { normalizeAnalyticsUrl } = await import('./analytics');
    expect(normalizeAnalyticsUrl('https://jobtrail.app/editor/abc123?x=1'))
      .toBe('https://jobtrail.app/editor/[id]?x=1');
  });

  test('passes through a non-parameterized url', async () => {
    const { normalizeAnalyticsUrl } = await import('./analytics');
    expect(normalizeAnalyticsUrl('https://jobtrail.app/applications'))
      .toBe('https://jobtrail.app/applications');
  });

  test('returns the input unchanged when it is not a parseable url', async () => {
    const { normalizeAnalyticsUrl } = await import('./analytics');
    expect(normalizeAnalyticsUrl('not-a-url')).toBe('not-a-url');
  });
});

describe('trackEvent', () => {
  test('forwards name and props to track', async () => {
    const { trackEvent } = await import('./analytics');
    trackEvent('ai_analysis_run', { ai: true });
    expect(trackMock).toHaveBeenCalledWith('ai_analysis_run', { ai: true });
  });

  test('forwards a bare name with no props', async () => {
    const { trackEvent } = await import('./analytics');
    trackEvent('application_created');
    expect(trackMock).toHaveBeenCalledWith('application_created', undefined);
  });

  test('never throws when the sdk fails', async () => {
    trackMock.mockImplementation(() => { throw new Error('sdk down'); });
    const { trackEvent } = await import('./analytics');
    expect(() => trackEvent('ai_analysis_run')).not.toThrow();
  });
});
