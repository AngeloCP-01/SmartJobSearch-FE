import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server, API } from '../test/server';
import Interviews from './Interviews';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><Interviews /></QueryClientProvider>);
}

test('lists interviews with their type and interviewer', async () => {
  server.use(
    http.get(`${API}/applications`, () => HttpResponse.json([{ id: 'a1', position: 'Eng' }])),
    http.get(`${API}/interviews`, () => HttpResponse.json([
      { id: 'i1', applicationId: 'a1', type: 'Technical', interviewer: 'Grace' },
    ])),
  );
  renderPage();
  // 'Grace' is unique to the list row; 'Technical' also appears as a <select> option,
  // so target the list pill <span> specifically.
  await waitFor(() => expect(screen.getByText('Grace')).toBeInTheDocument());
  expect(screen.getByText('Technical', { selector: 'span' })).toBeInTheDocument();
});
