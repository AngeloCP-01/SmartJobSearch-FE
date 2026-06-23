import api from './client';

export async function register(body) {
  const { data } = await api.post('/auth/register', body);
  return data; // { user, accessToken }
}
export async function login(body) {
  const { data } = await api.post('/auth/login', body);
  return data; // { user, accessToken }
}
export async function logout() {
  await api.post('/auth/logout');
}
export async function fetchMe() {
  const { data } = await api.get('/auth/me');
  return data.user;
}
