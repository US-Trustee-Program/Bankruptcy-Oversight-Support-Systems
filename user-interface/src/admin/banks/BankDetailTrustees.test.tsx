import { vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BankDetailTrustees } from './BankDetailTrustees';
import Api2 from '@/lib/models/api2';
import { TrusteeSummary } from '@common/cams/trustees';
import { ResponseBody } from '@common/api/response';

describe('BankDetailTrustees', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function renderComponent(bankName = 'First National Bank', bankId = 'bank-1') {
    return render(
      <MemoryRouter>
        <BankDetailTrustees bankName={bankName} bankId={bankId} />
      </MemoryRouter>,
    );
  }

  test('should show loading spinner during fetch', () => {
    vi.spyOn(Api2, 'getBankTrustees').mockReturnValue(new Promise(() => {}));

    renderComponent();

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  test('should show error alert on fetch failure', async () => {
    vi.spyOn(Api2, 'getBankTrustees').mockRejectedValue(new Error('Network error'));

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/Failed to load trustees/)).toBeInTheDocument();
    });
  });

  test('should render heading, count, and trustee name links after loading', async () => {
    const response: ResponseBody<TrusteeSummary[]> = {
      data: [
        { id: 'doc-1', trusteeId: 'trustee-1', name: 'Adams, John' },
        { id: 'doc-2', trusteeId: 'trustee-2', name: 'Baker, Jane' },
      ],
      pagination: { count: 2, totalCount: 2, currentPage: 1, totalPages: 1, limit: 25 },
    };
    vi.spyOn(Api2, 'getBankTrustees').mockResolvedValue(response);

    renderComponent('First National Bank');

    await waitFor(() => {
      expect(screen.getByText('Trustees using First National Bank')).toBeInTheDocument();
    });
    expect(screen.getByText('2 Trustees')).toBeInTheDocument();

    const link1 = screen.getByRole('link', { name: 'Adams, John' });
    expect(link1).toHaveAttribute('href', '/trustees/trustee-1');

    const link2 = screen.getByRole('link', { name: 'Baker, Jane' });
    expect(link2).toHaveAttribute('href', '/trustees/trustee-2');
  });

  test('should render singular trustee count for one trustee', async () => {
    const response: ResponseBody<TrusteeSummary[]> = {
      data: [{ id: 'doc-1', trusteeId: 'trustee-1', name: 'Adams, John' }],
      pagination: { count: 1, totalCount: 1, currentPage: 1, totalPages: 1, limit: 25 },
    };
    vi.spyOn(Api2, 'getBankTrustees').mockResolvedValue(response);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('1 Trustee')).toBeInTheDocument();
    });
  });

  test('should render empty-state message when no trustees exist', async () => {
    const response: ResponseBody<TrusteeSummary[]> = {
      data: [],
      pagination: { count: 0, totalCount: 0, currentPage: 1, totalPages: 1, limit: 25 },
    };
    vi.spyOn(Api2, 'getBankTrustees').mockResolvedValue(response);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('no-trustees-message')).toBeInTheDocument();
      expect(screen.getByText('No trustees found.')).toBeInTheDocument();
    });
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument();
  });

  test('should render pagination when multiple pages exist', async () => {
    const response: ResponseBody<TrusteeSummary[]> = {
      data: Array.from({ length: 25 }, (_, i) => ({
        id: `doc-${i}`,
        trusteeId: `trustee-${i}`,
        name: `Trustee ${i}`,
      })),
      pagination: { count: 25, totalCount: 50, currentPage: 1, totalPages: 2, limit: 25 },
    };
    vi.spyOn(Api2, 'getBankTrustees').mockResolvedValue(response);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument();
    });
  });

  test('should not update state after unmount during fetch', async () => {
    let resolveApi: (value: ResponseBody<TrusteeSummary[]>) => void;
    const pendingPromise = new Promise<ResponseBody<TrusteeSummary[]>>((resolve) => {
      resolveApi = resolve;
    });
    vi.spyOn(Api2, 'getBankTrustees').mockReturnValue(pendingPromise);

    const { unmount } = renderComponent();

    expect(screen.getByText('Loading...')).toBeInTheDocument();

    unmount();

    resolveApi!({
      data: [{ id: 'doc-1', trusteeId: 'trustee-1', name: 'Adams, John' }],
      pagination: { count: 1, totalCount: 1, currentPage: 1, totalPages: 1, limit: 25 },
    });

    await new Promise((r) => setTimeout(r, 0));
  });
});
