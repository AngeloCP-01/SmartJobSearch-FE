import api, { apiV2 } from './client';
import { compactParams } from './params';

// No argument = every row, on v1. ApplicationDrawer and ContactDrawer both call
// it that way to fill their company dropdown; point this at v2 and those
// dropdowns truncate even though their cache key never collides with the page's.
export async function listCompanies(search) {
  const { data } = await api.get('/companies', { params: search ? { search } : {} });
  return data;
}

// One page, on v2. Blanks are dropped — `?search=` is a 400, not "no filter".
export async function listCompaniesPage(params = {}) {
  const { data } = await apiV2.get('/companies', { params: compactParams(params) });
  return data;
}

export async function createCompany(body) {
  const { data } = await api.post('/companies', body);
  return data;
}
export async function deleteCompany(id) {
  await api.delete(`/companies/${id}`);
}
