import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Pager from './Pager';

const props = (over) => ({
  page: 1, pageSize: 25, total: 137, totalPages: 6,
  onPageChange: vi.fn(), onPageSizeChange: vi.fn(), ...over,
});

test('shows the range and offers exactly the allowlisted page sizes', () => {
  render(<Pager {...props()} />);
  expect(screen.getByText('1–25 of 137')).toBeInTheDocument();
  // Anything outside 10/25/50/100 is a 400 from v2, so the selector must not be
  // able to ask for one.
  expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['10', '25', '50', '100']);
});

test('renders nothing at all when there are no results', () => {
  const { container } = render(<Pager {...props({ total: 0, totalPages: 0 })} />);
  expect(container).toBeEmptyDOMElement();
});

test('marks the current page and disables Previous on the first page', () => {
  render(<Pager {...props()} />);
  expect(screen.getByRole('button', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('button', { name: /previous page/i })).toBeDisabled();
  expect(screen.getByRole('button', { name: /next page/i })).toBeEnabled();
});

test('disables Next on the last page', () => {
  render(<Pager {...props({ page: 6 })} />);
  expect(screen.getByRole('button', { name: /next page/i })).toBeDisabled();
});

test('Next and a numbered button report the page they want', async () => {
  const onPageChange = vi.fn();
  render(<Pager {...props({ page: 3, onPageChange })} />);
  await userEvent.click(screen.getByRole('button', { name: /next page/i }));
  expect(onPageChange).toHaveBeenCalledWith(4);
  await userEvent.click(screen.getByRole('button', { name: 'Page 6' }));
  expect(onPageChange).toHaveBeenCalledWith(6);
});

test('the size selector reports a number, not the string the DOM hands back', async () => {
  const onPageSizeChange = vi.fn();
  render(<Pager {...props({ onPageSizeChange })} />);
  await userEvent.selectOptions(screen.getByLabelText(/rows per page/i), '50');
  expect(onPageSizeChange).toHaveBeenCalledWith(50);
});
