import api from './client';

export async function listCompanies(search) {
  const { data } = await api.get('/companies', { params: search ? { search } : {} });
  return data;
}
export async function createCompany(body) {
  const { data } = await api.post('/companies', body);
  return data;
}
export async function deleteCompany(id) {
  await api.delete(`/companies/${id}`);
}
