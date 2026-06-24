import api from './client';

export async function fetchActivity({ applicationId, before } = {}) {
  const params = {};
  if (applicationId) params.applicationId = applicationId;
  if (before) params.before = before;
  const { data } = await api.get('/activity', { params });
  return data;
}
