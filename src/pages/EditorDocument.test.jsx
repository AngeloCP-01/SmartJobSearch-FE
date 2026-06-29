import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { server, API } from '../test/server';
import EditorDocument from './EditorDocument';

const DOC = {
  id: 'doc1', title: 'My Resume', type: 'Resume', applicationId: null,
  content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Experience' }] }] },
};

function renderEditor() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/editor/doc1']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/editor/:id" element={<EditorDocument />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

test('loads the document title and content', async () => {
  server.use(http.get(`${API}/authored-documents/doc1`, () => HttpResponse.json(DOC)));
  renderEditor();
  await waitFor(() => expect(screen.getByDisplayValue('My Resume')).toBeInTheDocument());
  expect(screen.getByText('Experience')).toBeInTheDocument();
});

test('autosaves an edited title and shows a saved status', async () => {
  let patched = null;
  server.use(
    http.get(`${API}/authored-documents/doc1`, () => HttpResponse.json(DOC)),
    http.patch(`${API}/authored-documents/doc1`, async ({ request }) => {
      patched = await request.json();
      return HttpResponse.json({ ...DOC, ...patched });
    }),
  );
  renderEditor();
  await waitFor(() => expect(screen.getByDisplayValue('My Resume')).toBeInTheDocument());

  const title = screen.getByLabelText(/document title/i);
  await userEvent.clear(title);
  await userEvent.type(title, 'Final Resume');

  await waitFor(() => expect(patched).not.toBeNull(), { timeout: 4000 });
  expect(patched.title).toBe('Final Resume');
  await waitFor(() => expect(screen.getByText(/saved/i)).toBeInTheDocument());
});

test('print button calls window.print', async () => {
  server.use(http.get(`${API}/authored-documents/doc1`, () => HttpResponse.json(DOC)));
  const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
  renderEditor();
  await waitFor(() => expect(screen.getByDisplayValue('My Resume')).toBeInTheDocument());
  await userEvent.click(screen.getByRole('button', { name: /print/i }));
  expect(printSpy).toHaveBeenCalled();
});
