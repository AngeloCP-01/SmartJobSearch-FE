import api from './client';

export async function runAnalysis({ applicationId, documentId, useAi }) {
  const { data } = await api.post('/analysis', { applicationId, documentId, useAi });
  return data;
}
export async function getAnalysisConfig() {
  const { data } = await api.get('/analysis/config');
  return data;
}
export async function generateCoverLetter({ applicationId, documentId }) {
  const { data } = await api.post('/analysis/cover-letter', { applicationId, documentId });
  return data;
}
export async function tailorResume({ applicationId, documentId }) {
  const { data } = await api.post('/analysis/tailor', { applicationId, documentId });
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
