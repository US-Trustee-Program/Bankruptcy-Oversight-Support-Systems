import { vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SoftwareBankTrustees } from './SoftwareBankTrustees';
import Api2 from '@/lib/models/api2';
import { TrusteeSummary } from '@common/cams/trustees';
import { ResponseBody } from '@common/api/response';

function renderComponent(softwareId = 'sw-1', bankId = 'bank-1') {
  return render(
    <MemoryRouter
      initialEntries={[`/admin/bankruptcy-software/${softwareId}/banks/${bankId}/trustees`]}
    >
      <Routes>
        <Route
          path="/admin/bankruptcy-software/:softwareId/banks/:bankId/trustees"
          element={<SoftwareBankTrustees />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SoftwareBankTrustees', () => {
  beforeEach(() => {
    vi.spyOn(Api2, 'getSoftwareName').mockResolvedValue({
      data: { name: 'Axos Financial' },
    } as never);
    vi.spyOn(Api2, 'getBank').mockResolvedValue({
      data: { id: 'bank-1', name: 'Chase Bank', status: 'active' },
    } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should show loading spinner during fetch', () => {
    vi.spyOn(Api2, 'getSoftwareBankTrustees').mockReturnValue(new Promise(() => {}));

    renderComponent();

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  test('should show error alert on fetch failure', async () => {
    vi.spyOn(Api2, 'getSoftwareBankTrustees').mockRejectedValue(new Error('Network error'));

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/Failed to load trustees/)).toBeInTheDocument();
    });
  });

  test('should render trustee names as links after loading', async () => {
    const response: ResponseBody<TrusteeSummary[]> = {
      data: [
        { id: 'doc-1', trusteeId: 'trustee-1', name: 'Adams, John' },
        { id: 'doc-2', trusteeId: 'trustee-2', name: 'Baker, Jane' },
      ],
      pagination: { count: 2, totalCount: 2, currentPage: 1, totalPages: 1, limit: 25 },
    };
    vi.spyOn(Api2, 'getSoftwareBankTrustees').mockResolvedValue(response);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('software-bank-trustees')).toBeInTheDocument();
    });

    expect(screen.getByText('2 Trustees')).toBeInTheDocument();
    const link1 = screen.getByRole('link', { name: 'Adams, John opens in a new tab' });
    expect(link1).toHaveAttribute('href', '/trustees/trustee-1');
    const link2 = screen.getByRole('link', { name: 'Baker, Jane opens in a new tab' });
    expect(link2).toHaveAttribute('href', '/trustees/trustee-2');
  });

  test('should render singular trustee count for one trustee', async () => {
    const response: ResponseBody<TrusteeSummary[]> = {
      data: [{ id: 'doc-1', trusteeId: 'trustee-1', name: 'Adams, John' }],
      pagination: { count: 1, totalCount: 1, currentPage: 1, totalPages: 1, limit: 25 },
    };
    vi.spyOn(Api2, 'getSoftwareBankTrustees').mockResolvedValue(response);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('1 Trustee')).toBeInTheDocument();
    });
  });

  test('should render empty-state when no trustees exist', async () => {
    const response: ResponseBody<TrusteeSummary[]> = {
      data: [],
      pagination: { count: 0, totalCount: 0, currentPage: 1, totalPages: 1, limit: 25 },
    };
    vi.spyOn(Api2, 'getSoftwareBankTrustees').mockResolvedValue(response);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('no-trustees-message')).toBeInTheDocument();
    });
  });

  test('should display software and bank names in headings and back link', async () => {
    const response: ResponseBody<TrusteeSummary[]> = {
      data: [],
      pagination: { count: 0, totalCount: 0, currentPage: 1, totalPages: 1, limit: 25 },
    };
    vi.spyOn(Api2, 'getSoftwareBankTrustees').mockResolvedValue(response);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Axos Financial')).toBeInTheDocument();
    });
    expect(screen.getByText('Trustees Using Chase Bank')).toBeInTheDocument();
    expect(screen.getByTestId('back-to-software-link')).toHaveTextContent('Back to Axos Financial');
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
    vi.spyOn(Api2, 'getSoftwareBankTrustees').mockResolvedValue(response);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument();
    });
  });

  test('should not render pagination when only one page exists', async () => {
    const response: ResponseBody<TrusteeSummary[]> = {
      data: [{ id: 'doc-1', trusteeId: 'trustee-1', name: 'Adams, John' }],
      pagination: { count: 1, totalCount: 1, currentPage: 1, totalPages: 1, limit: 25 },
    };
    vi.spyOn(Api2, 'getSoftwareBankTrustees').mockResolvedValue(response);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('software-bank-trustees')).toBeInTheDocument();
    });
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument();
  });

  test('should handle response without pagination field', async () => {
    const response: ResponseBody<TrusteeSummary[]> = {
      data: [{ id: 'doc-1', trusteeId: 'trustee-1', name: 'Adams, John' }],
    };
    vi.spyOn(Api2, 'getSoftwareBankTrustees').mockResolvedValue(response);

    renderComponent();

    await waitFor(() => {
      expect(
        screen.getByRole('link', { name: 'Adams, John opens in a new tab' }),
      ).toBeInTheDocument();
    });
  });

  test('should gracefully handle name fetch failure', async () => {
    vi.spyOn(Api2, 'getSoftwareName').mockRejectedValue(new Error('Not found'));
    vi.spyOn(Api2, 'getBank').mockRejectedValue(new Error('Not found'));

    const response: ResponseBody<TrusteeSummary[]> = {
      data: [],
      pagination: { count: 0, totalCount: 0, currentPage: 1, totalPages: 1, limit: 25 },
    };
    vi.spyOn(Api2, 'getSoftwareBankTrustees').mockResolvedValue(response);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('software-bank-trustees')).toBeInTheDocument();
    });
    expect(screen.getByTestId('back-to-software-link')).toHaveTextContent('Back to Software');
  });
});
