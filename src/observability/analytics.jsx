// Central (and only) Vercel Analytics + Speed Insights integration point.
// Mounted from main.jsx as a sibling of <App/> — deliberately outside the
// component tree that Vitest renders, so the MSW setup (onUnhandledRequest:
// 'error') needs no analytics mock. Mirrors the sentry.js module convention.
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { track } from '@vercel/analytics';
import { useLocation } from 'react-router-dom';

// /editor/:id is the only parameterized route in the app (see App.jsx). Vercel
// auto-fills `route` for Next/Nuxt/SvelteKit/Remix but NOT for React/Vite, so
// without this every document id becomes its own dashboard row — unreadable,
// and it burns the 50k/mo free-tier event budget.
function normalizeRoute(pathname) {
  return pathname.replace(/^\/editor\/[^/]+/, '/editor/[id]').replace(/^(.+)\/$/, '$1');
}

// The <Analytics/> React build exposes no `route` prop — URL rewriting goes
// through beforeSend instead. Speed Insights uses `route`. Same normalization,
// two different APIs.
function normalizeAnalyticsUrl(url) {
  try {
    const u = new URL(url);
    u.pathname = normalizeRoute(u.pathname);
    return u.toString();
  } catch {
    return url; // not parseable — send as-is rather than dropping the event
  }
}

// Analytics must never break a user flow, so failures are swallowed.
function trackEvent(name, props) {
  try {
    track(name, props);
  } catch {
    // intentionally ignored
  }
}

function WebVitals() {
  const route = normalizeRoute(useLocation().pathname);
  return (
    <>
      <Analytics beforeSend={(e) => ({ ...e, url: normalizeAnalyticsUrl(e.url) })} />
      <SpeedInsights route={route} />
    </>
  );
}

export { WebVitals, trackEvent, normalizeRoute, normalizeAnalyticsUrl };
