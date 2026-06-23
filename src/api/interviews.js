import api from './client';

export async function listInterviews() {
  const { data } = await api.get('/interviews');
  return data;
}
export async function createInterview(body) {
  const { data } = await api.post('/interviews', body);
  return data;
}
export async function deleteInterview(id) {
  await api.delete(`/interviews/${id}`);
}
