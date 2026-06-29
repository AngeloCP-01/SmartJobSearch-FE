import api from './client';

export async function listAuthoredDocuments() {
  const { data } = await api.get('/authored-documents');
  return data;
}

export async function getAuthoredDocument(id) {
  const { data } = await api.get(`/authored-documents/${id}`);
  return data;
}

export async function createAuthoredDocument(body) {
  const { data } = await api.post('/authored-documents', body);
  return data;
}

export async function updateAuthoredDocument(id, body) {
  const { data } = await api.patch(`/authored-documents/${id}`, body);
  return data;
}

export async function deleteAuthoredDocument(id) {
  await api.delete(`/authored-documents/${id}`);
}
