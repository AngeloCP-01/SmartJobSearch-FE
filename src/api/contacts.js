import api, { apiV2 } from './client';
import { compactParams } from './params';

// No argument = every row, on v1. ApplicationDrawer calls it that way to fill
// its contact dropdown; point this at v2 and that dropdown truncates.
export async function listContacts(search) {
  const { data } = await api.get('/contacts', { params: search ? { search } : {} });
  return data;
}

// One page, on v2. Blanks are dropped — `?search=` is a 400, not "no filter".
export async function listContactsPage(params = {}) {
  const { data } = await apiV2.get('/contacts', { params: compactParams(params) });
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
