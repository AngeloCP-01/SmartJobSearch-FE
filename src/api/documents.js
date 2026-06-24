import api from './client';

export async function listDocuments(search) {
  const { data } = await api.get('/documents', { params: search ? { search } : {} });
  return data;
}
export async function createDocument(formData) {
  const { data } = await api.post('/documents', formData);
  return data;
}
export async function updateDocument(id, body) {
  const { data } = await api.patch(`/documents/${id}`, body);
  return data;
}
export async function deleteDocument(id) {
  await api.delete(`/documents/${id}`);
}
export async function downloadDocument(id) {
  const { data } = await api.get(`/documents/${id}/file`, { responseType: 'blob' });
  return data;
}
export async function linkDocument(applicationId, documentId) {
  const { data } = await api.post(`/applications/${applicationId}/documents`, { documentId });
  return data;
}
export async function unlinkDocument(applicationId, documentId) {
  await api.delete(`/applications/${applicationId}/documents/${documentId}`);
}
