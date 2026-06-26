import api from './client';

export async function parsePosting(content) {
  const { data } = await api.post('/postings/parse', { content });
  return data;
}
