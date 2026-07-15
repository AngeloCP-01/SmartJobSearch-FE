import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handlePreloadError, THROTTLE_MS } from './chunkReload';

describe('handlePreloadError (stale-chunk recovery after redeploy)', () => {
  // jsdom's location.reload is non-configurable, so stub the whole location.
  let reload;
  let originalLocation;

  beforeEach(() => {
    window.sessionStorage.clear();
    originalLocation = window.location;
    reload = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { reload },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
    vi.restoreAllMocks();
  });

  it('reloads once on the first preload error', () => {
    expect(handlePreloadError()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not reload again within the throttle window (prevents refresh loops)', () => {
    handlePreloadError();
    reload.mockClear();
    expect(handlePreloadError()).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('reloads again after the throttle window elapses', () => {
    const t0 = 1_000_000;
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(t0);
    handlePreloadError();
    reload.mockClear();

    nowSpy.mockReturnValue(t0 + THROTTLE_MS + 1);
    expect(handlePreloadError()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
