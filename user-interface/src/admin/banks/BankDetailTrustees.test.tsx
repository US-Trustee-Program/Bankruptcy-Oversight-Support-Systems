import { vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
      expect(screen.getByTestId('alert-bank-trustees-load-error')).toBeInTheDocument();
    });
    expect(screen.getByTestId('alert-message-bank-trustees-load-error')).toHaveTextContent(
      /Failed to load trustees/,
    );
  });

  test('should pass bankId to API and render heading, count, and trustee links', async () => {
    const response: ResponseBody<TrusteeSummary[]> = {
      data: [
        { id: 'doc-1', trusteeId: 'trustee-1', name: 'Adams, John' },
        { id: 'doc-2', trusteeId: 'trustee-2', name: 'Baker, Jane' },
      ],
      pagination: { count: 2, totalCount: 2, currentPage: 1, totalPages: 1, limit: 25 },
    };
    const spy = vi.spyOn(Api2, 'getBankTrustees').mockResolvedValue(response);

    renderComponent('First National Bank', 'bank-42');

    await waitFor(() => {
      expect(screen.getByTestId('bank-trustees-heading')).toBeInTheDocument();
    });

    expect(spy).toHaveBeenCalledWith('bank-42', 25, 0);
    expect(screen.getByTestId('bank-trustees-heading')).toHaveTextContent(
      'Trustees using First National Bank',
    );
    expect(screen.getByTestId('bank-trustees-count')).toHaveTextContent('2 Trustees');

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
      expect(screen.getByTestId('bank-trustees-count')).toHaveTextContent('1 Trustee');
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
    });
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument();
  });

  test('should fetch next page when pagination button is clicked', async () => {
    const page1Response: ResponseBody<TrusteeSummary[]> = {
      data: Array.from({ length: 25 }, (_, i) => ({
        id: `doc-${i}`,
        trusteeId: `trustee-${i}`,
        name: `Trustee ${i}`,
      })),
      pagination: { count: 25, totalCount: 50, currentPage: 1, totalPages: 2, limit: 25 },
    };
    const page2Response: ResponseBody<TrusteeSummary[]> = {
      data: Array.from({ length: 25 }, (_, i) => ({
        id: `doc-${i + 25}`,
        trusteeId: `trustee-${i + 25}`,
        name: `Trustee ${i + 25}`,
      })),
      pagination: { count: 25, totalCount: 50, currentPage: 2, totalPages: 2, limit: 25 },
    };
    const spy = vi
      .spyOn(Api2, 'getBankTrustees')
      .mockResolvedValueOnce(page1Response)
      .mockResolvedValueOnce(page2Response);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('pagination-button-page-2-results'));

    await waitFor(() => {
      expect(spy).toHaveBeenCalledTimes(2);
    });
    expect(spy).toHaveBeenLastCalledWith('bank-1', 25, 25);
  });

  test('should not trigger console error after unmount during fetch', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error');
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

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
