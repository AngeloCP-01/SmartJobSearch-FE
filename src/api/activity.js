import api, { apiV2 } from './client';
import { compactParams } from './params';

// v1. Still used by the ApplicationDrawer's per-application timeline, which
// renders one bounded list and never pages.
export async function fetchActivity({ applicationId, before } = {}) {
  const params = {};
  if (applicationId) params.applicationId = applicationId;
  if (before) params.before = before;
  const { data } = await api.get('/activity', { params });
  return data;
}

// v2. Cursor, not offset — activity is an append-only feed, and offset over a
// feed that grows at the top duplicates and skips rows. The size parameter is
// `pageSize` here (v1 called it `limit`) and is validated against the
// 10/25/50/100 allowlist rather than clamped, so an arbitrary number is a 400.
// Callers pass the size; this module deliberately does not reach into
// src/lib for the default, so the api layer stays free of React imports.
export async function fetchActivityPage({ applicationId, before, pageSize } = {}) {
  const { data } = await apiV2.get('/activity', {
    params: compactParams({ applicationId, before, pageSize }),
  });
  return data;
}
