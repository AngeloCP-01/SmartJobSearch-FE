import api from './client';

export async function fetchReminders() {
  const { data } = await api.get('/reminders');
  return data;
}
