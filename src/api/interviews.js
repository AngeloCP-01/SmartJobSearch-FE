import api from './client';

export async function listInterviews(applicationId) {
  const { data } = await api.get('/interviews', { params: applicationId ? { applicationId } : {} });
  return data;
}
export async function createInterview(body) {
  const { data } = await api.post('/interviews', body);
  return data;
}
export async function updateInterview(id, body) {
  const { data } = await api.patch(`/interviews/${id}`, body);
  return data;
}
export async function deleteInterview(id) {
  await api.delete(`/interviews/${id}`);
}
