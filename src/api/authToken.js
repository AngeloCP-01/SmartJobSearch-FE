let accessToken = null;
const listeners = new Set();

export function getAccessToken() { return accessToken; }
export function setAccessToken(token) { accessToken = token; }
export function onUnauthorized(cb) { listeners.add(cb); return () => listeners.delete(cb); }
export function emitUnauthorized() { listeners.forEach((cb) => cb()); }
