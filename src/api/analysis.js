import api, { apiV2 } from './client';
import { compactParams } from './params';

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
// Every row, on v1. No caller needs this today, but it is the escape hatch if
// one appears — and it keeps the v1/v2 pairing consistent across modules.
export async function listAnalyses() {
  const { data } = await api.get('/analysis');
  return data;
}

// One page, on v2. Sortable on createdAt | atsScore | matchScore only:
// documentName and position are projected out of report.meta JSON rather than
// stored as columns, so the API 400s on them.
export async function listAnalysesPage(params = {}) {
  const { data } = await apiV2.get('/analysis', { params: compactParams(params) });
  return data;
}
export async function getAnalysis(id) {
  const { data } = await api.get(`/analysis/${id}`);
  return data;
}
export async function deleteAnalysis(id) {
  await api.delete(`/analysis/${id}`);
}
