// Central (and only) Sentry integration point for the browser. Fully no-op
// unless VITE_SENTRY_DSN is set, so local dev and the Vitest suite make no
// network calls and need no config. Mirrors the backend observability module.
import * as Sentry from '@sentry/react';

let enabled = false;

// beforeSend hook: strip the auth header so the in-memory access token is never
// transmitted (defense-in-depth; sendDefaultPii:false already omits headers).
function scrub(event) {
  const h = event && event.request && event.request.headers;
  if (h) {
    delete h.Authorization;
    delete h.authorization;
  }
  return event;
}

function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return; // unconfigured → stay inert
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // release is intentionally omitted — @sentry/vite-plugin injects it at build
    // time so it matches the uploaded source maps.
    tracesSampleRate: 0, // errors only — no performance tracing
    sendDefaultPii: false,
    beforeSend: scrub,
  });
  enabled = true;
}

function captureError(err) {
  if (!enabled) return;
  Sentry.captureException(err);
}

export { initSentry, captureError, scrub };
