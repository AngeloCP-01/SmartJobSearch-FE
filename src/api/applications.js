import api from './client';

export async function listApplications() {
  const { data } = await api.get('/applications');
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
