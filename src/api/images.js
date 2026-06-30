import api from './client';

export async function uploadImage(file) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post('/images', form);
  return data; // { id, url }
}
