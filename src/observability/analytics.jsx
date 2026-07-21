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
// and it burns the 50k/mo free-tier event budget. The second .replace is
// generic trailing-slash canonicalisation applied to every route, not just
// /editor/ — it's intentional: it merges e.g. /applications/ and /applications
// into a single dashboard row.
function normalizeRoute(pathname) {
  return pathname.replace(/^\/editor\/[^/]+/, '/editor/[id]').replace(/^(.+)\/$/, '$1');
}

// <Analytics/> does expose `route`/`path` props (@vercel/analytics 2.0.1), but
// passing `route` flips on `disableAutoTrack` and requires firing pageviews
// ourselves. We use `beforeSend` instead so the vendor's automatic pageview
// tracking stays on — same normalization as Speed Insights, reached through a
// different API.
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

// Hoisted to module scope: it closes over nothing, so a stable reference here
// avoids re-running the vendor's internal [beforeSend] effect on every render.
const rewriteUrl = (e) => ({ ...e, url: normalizeAnalyticsUrl(e.url) });

function WebVitals() {
  const route = normalizeRoute(useLocation().pathname);
  return (
    <>
      <Analytics beforeSend={rewriteUrl} />
      <SpeedInsights route={route} />
    </>
  );
}

export { WebVitals, trackEvent, normalizeRoute, normalizeAnalyticsUrl };
