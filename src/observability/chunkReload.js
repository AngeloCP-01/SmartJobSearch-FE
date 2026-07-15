// Recovers from stale lazy-chunk imports after a redeploy. Vite dispatches a
// `vite:preloadError` event when a dynamically-import()'d chunk fails to load.
// That happens when a new deploy replaces the content-hashed filenames a
// still-open tab is trying to fetch: the old chunk no longer exists, so the SPA
// rewrite serves index.html (HTTP 200, text/html) and the import() rejects with
// "Failed to fetch dynamically imported module".
//
// Fix: reload once so the browser pulls the fresh index.html + current chunk
// manifest. Throttled via sessionStorage so a genuinely broken deploy (chunk
// missing even after reload) can't put the tab into a hard refresh loop.

const RELOAD_KEY = 'chunk-reload:last';
const THROTTLE_MS = 10_000;

// Returns true if it triggered a reload, false if throttled. Exported for tests.
function handlePreloadError() {
  const now = Date.now();
  const last = Number(window.sessionStorage.getItem(RELOAD_KEY) || 0);
  if (now - last < THROTTLE_MS) return false; // reloaded recently → don't loop
  window.sessionStorage.setItem(RELOAD_KEY, String(now));
  window.location.reload();
  return true;
}

function installChunkReloadHandler() {
  window.addEventListener('vite:preloadError', (event) => {
    // Stop Vite from rethrowing the error (which would also hit the error
    // boundary / Sentry) — we're recovering by reloading.
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    handlePreloadError();
  });
}

export { installChunkReloadHandler, handlePreloadError, RELOAD_KEY, THROTTLE_MS };
