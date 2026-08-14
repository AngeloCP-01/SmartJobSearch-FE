import { http, HttpResponse } from 'msw';
import { server, API, API_V2 } from '../test/server';
import { listApplications, listApplicationsPage } from './applications';

test('listApplications still hits v1 and returns the bare array', async () => {
  // The four dropdown pages and the Kanban board depend on this staying v1.
  server.use(http.get(`${API}/applications`, () => HttpResponse.json([{ id: 'a1' }])));
  await expect(listApplications()).resolves.toEqual([{ id: 'a1' }]);
});

test('listApplicationsPage hits v2 and returns the offset envelope', async () => {
  let seen = null;
  server.use(http.get(`${API_V2}/applications`, ({ request }) => {
    seen = Object.fromEntries(new URL(request.url).searchParams);
    return HttpResponse.json({ items: [{ id: 'a1' }], page: 2, pageSize: 25, total: 30, totalPages: 2 });
  }));
  const data = await listApplicationsPage({ page: 2, pageSize: 25, sort: 'applicationDate', dir: 'desc' });
  expect(seen).toEqual({ page: '2', pageSize: '25', sort: 'applicationDate', dir: 'desc' });
  expect(data.total).toBe(30);
});

test('listApplicationsPage omits blank filters rather than sending them empty', async () => {
  // `?search=` is a 400 from v2 (search is min(1) after trim), not "no filter".
  let seen = null;
  server.use(http.get(`${API_V2}/applications`, ({ request }) => {
    seen = Object.fromEntries(new URL(request.url).searchParams);
    return HttpResponse.json({ items: [], page: 1, pageSize: 25, total: 0, totalPages: 0 });
  }));
  await listApplicationsPage({ page: 1, pageSize: 25, search: '', status: '', companyId: '' });
  expect(seen).toEqual({ page: '1', pageSize: '25' });
});
