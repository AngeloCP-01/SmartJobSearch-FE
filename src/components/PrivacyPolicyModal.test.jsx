import { expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PrivacyPolicyModal from './PrivacyPolicyModal';

test('renders nothing when closed', () => {
  const { container } = render(<PrivacyPolicyModal open={false} onClose={() => {}} />);
  expect(container).toBeEmptyDOMElement();
});

test('renders the dialog with all three data disclosures when open', () => {
  render(<PrivacyPolicyModal open onClose={() => {}} />);
  const dialog = screen.getByRole('dialog');
  expect(dialog).toHaveAttribute('aria-modal', 'true');
  expect(dialog).toHaveTextContent(/vercel/i);
  expect(dialog).toHaveTextContent(/sentry/i);
  expect(dialog).toHaveTextContent(/openrouter/i);
});

test('discloses all four OpenRouter-backed AI paths, not just résumé analysis', () => {
  render(<PrivacyPolicyModal open onClose={() => {}} />);
  const dialog = screen.getByRole('dialog');
  expect(dialog).toHaveTextContent(/résumé analysis/i);
  expect(dialog).toHaveTextContent(/cover letter/i);
  expect(dialog).toHaveTextContent(/tailoring/i);
  expect(dialog).toHaveTextContent(/auto-fill/i);
});

test('closes via the close button', async () => {
  const onClose = vi.fn();
  const user = userEvent.setup();
  render(<PrivacyPolicyModal open onClose={onClose} />);
  await user.click(screen.getByRole('button', { name: /close/i }));
  expect(onClose).toHaveBeenCalled();
});

test('closes on Escape', async () => {
  const onClose = vi.fn();
  const user = userEvent.setup();
  render(<PrivacyPolicyModal open onClose={onClose} />);
  await user.keyboard('{Escape}');
  expect(onClose).toHaveBeenCalled();
});
