import { getAccessToken } from './authToken';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';

export async function uploadImage(file) {
  const form = new FormData();
  form.append('file', file);
  const token = getAccessToken();
  const res = await fetch(`${BASE}/images`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json(); // { id, url }
}
