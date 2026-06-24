import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server, API } from '../test/server';
import DocumentDrawer from './DocumentDrawer';

const DOC = { id: 'd1', name: 'Old Name', type: 'Resume', notes: '', originalFilename: 'r.pdf', mimeType: 'application/pdf', sizeBytes: 100 };

function renderDrawer(props = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <DocumentDrawer open document={DOC} onClose={() => {}} {...props} />
    </QueryClientProvider>,
  );
}

test('edits document metadata via PATCH', async () => {
  let patched = null;
  server.use(http.patch(`${API}/documents/d1`, async ({ request }) => {
    patched = await request.json();
    return HttpResponse.json({ ...DOC, ...patched });
  }));
  renderDrawer();
  const nameInput = screen.getByLabelText('Name');
  await userEvent.clear(nameInput);
  await userEvent.type(nameInput, 'New Name');
  await userEvent.click(screen.getByRole('button', { name: /save/i }));
  await waitFor(() => expect(patched).toMatchObject({ name: 'New Name' }));
});
