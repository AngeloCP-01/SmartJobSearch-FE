import api, { apiV2 } from './client';
import { compactParams } from './params';

// Every row, unpaginated, on v1. Feeds the Kanban board (which needs every row
// to populate its columns and drag between them) and the four "pick an
// application" dropdowns. Do NOT point this at v2 — see
// docs/KICKOFF-v2-pagination.md; a paginated subset here reads as missing data.
export async function listApplications() {
  const { data } = await api.get('/applications');
  return data;
}

// One page, on v2. Blank filters are dropped rather than sent empty: v2
// validates (`search` is min(1) after trim, `companyId` a uuid, `status` an
// enum), so `?search=` would be a 400.
export async function listApplicationsPage(params = {}) {
  const { data } = await apiV2.get('/applications', { params: compactParams(params) });
  return data;
}
export async function getApplication(id) {
  const { data } = await api.get(`/applications/${id}`);
  return data;
}
export async function createApplication(body) {
  const { data } = await api.post('/applications', body);
  return data;
}
export async function updateStatus(id, status) {
  const { data } = await api.patch(`/applications/${id}/status`, { status });
  return data;
}
export async function updateApplication(id, body) {
  const { data } = await api.patch(`/applications/${id}`, body);
  return data;
}
export async function deleteApplication(id) {
  await api.delete(`/applications/${id}`);
}
