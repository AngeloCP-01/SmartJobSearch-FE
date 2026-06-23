import api from './client';

export async function fetchSummary() {
  const { data } = await api.get('/dashboard/summary');
  return data;
}
