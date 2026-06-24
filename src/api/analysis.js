import api from './client';

export async function runAnalysis({ applicationId, documentId }) {
  const { data } = await api.post('/analysis', { applicationId, documentId });
  return data;
}
export async function listAnalyses() {
  const { data } = await api.get('/analysis');
  return data;
}
export async function getAnalysis(id) {
  const { data } = await api.get(`/analysis/${id}`);
  return data;
}
export async function deleteAnalysis(id) {
  await api.delete(`/analysis/${id}`);
}
