import api from './client';

export async function listContacts(search) {
  const { data } = await api.get('/contacts', { params: search ? { search } : {} });
  return data;
}
export async function getContact(id) {
  const { data } = await api.get(`/contacts/${id}`);
  return data;
}
export async function createContact(body) {
  const { data } = await api.post('/contacts', body);
  return data;
}
export async function updateContact(id, body) {
  const { data } = await api.patch(`/contacts/${id}`, body);
  return data;
}
export async function deleteContact(id) {
  await api.delete(`/contacts/${id}`);
}
export async function linkContact(applicationId, contactId) {
  const { data } = await api.post(`/applications/${applicationId}/contacts`, { contactId });
  return data;
}
export async function unlinkContact(applicationId, contactId) {
  await api.delete(`/applications/${applicationId}/contacts/${contactId}`);
}
