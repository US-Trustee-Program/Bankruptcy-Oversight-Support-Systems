import { vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BankruptcySoftwareDetailTrustees } from './BankruptcySoftwareDetailTrustees';
import Api2 from '@/lib/models/api2';
import { TrusteeSummary } from '@common/cams/trustees';
import { ResponseBody } from '@common/api/response';

describe('BankruptcySoftwareDetailTrustees', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function renderComponent(softwareName = 'TestVendor', softwareId = 'sw-1') {
    return render(
      <MemoryRouter>
        <BankruptcySoftwareDetailTrustees softwareName={softwareName} softwareId={softwareId} />
      </MemoryRouter>,
    );
  }

  test('should render heading with vendor name', async () => {
    const response: ResponseBody<TrusteeSummary[]> = {
      data: [{ id: 'doc-1', trusteeId: 'trustee-1', name: 'Adams, John' }],
      pagination: { count: 1, totalCount: 1, currentPage: 1, totalPages: 1, limit: 25 },
    };
    vi.spyOn(Api2, 'getSoftwareTrustees').mockResolvedValue(response);

    renderComponent('Axos Financial');

    await waitFor(() => {
      expect(screen.getByText('Trustees using Axos Financial')).toBeInTheDocument();
    });
  });

  test('should render trustee count', async () => {
    const response: ResponseBody<TrusteeSummary[]> = {
      data: [
        { id: 'doc-1', trusteeId: 'trustee-1', name: 'Adams, John' },
        { id: 'doc-2', trusteeId: 'trustee-2', name: 'Baker, Jane' },
      ],
      pagination: { count: 2, totalCount: 2, currentPage: 1, totalPages: 1, limit: 25 },
    };
    vi.spyOn(Api2, 'getSoftwareTrustees').mockResolvedValue(response);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('2 Trustees')).toBeInTheDocument();
    });
  });

  test('should render singular trustee count', async () => {
    const response: ResponseBody<TrusteeSummary[]> = {
      data: [{ id: 'doc-1', trusteeId: 'trustee-1', name: 'Adams, John' }],
      pagination: { count: 1, totalCount: 1, currentPage: 1, totalPages: 1, limit: 25 },
    };
    vi.spyOn(Api2, 'getSoftwareTrustees').mockResolvedValue(response);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('1 Trustee')).toBeInTheDocument();
    });
  });

  test('should render trustee names as links', async () => {
    const response: ResponseBody<TrusteeSummary[]> = {
      data: [
        { id: 'doc-1', trusteeId: 'trustee-1', name: 'Adams, John' },
        { id: 'doc-2', trusteeId: 'trustee-2', name: 'Baker, Jane' },
      ],
      pagination: { count: 2, totalCount: 2, currentPage: 1, totalPages: 1, limit: 25 },
    };
    vi.spyOn(Api2, 'getSoftwareTrustees').mockResolvedValue(response);

    renderComponent();

    await waitFor(() => {
      const link1 = screen.getByRole('link', { name: 'Adams, John' });
      expect(link1).toHaveAttribute('href', '/admin/trustees/trustee-1');

      const link2 = screen.getByRole('link', { name: 'Baker, Jane' });
      expect(link2).toHaveAttribute('href', '/admin/trustees/trustee-2');
    });
  });

  test('should show loading spinner during fetch', () => {
    vi.spyOn(Api2, 'getSoftwareTrustees').mockReturnValue(new Promise(() => {}));

    renderComponent();

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  test('should show error alert on fetch failure', async () => {
    vi.spyOn(Api2, 'getSoftwareTrustees').mockRejectedValue(new Error('Network error'));

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/Failed to load trustees/)).toBeInTheDocument();
    });
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
    vi.spyOn(Api2, 'getSoftwareTrustees').mockResolvedValue(response);

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
    vi.spyOn(Api2, 'getSoftwareTrustees').mockResolvedValue(response);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Adams, John')).toBeInTheDocument();
    });
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument();
  });

  test('should render empty-state message when no trustees exist', async () => {
    const response: ResponseBody<TrusteeSummary[]> = {
      data: [],
      pagination: { count: 0, totalCount: 0, currentPage: 1, totalPages: 1, limit: 25 },
    };
    vi.spyOn(Api2, 'getSoftwareTrustees').mockResolvedValue(response);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('no-trustees-message')).toBeInTheDocument();
      expect(screen.getByText('No trustees found.')).toBeInTheDocument();
    });
  });

  test('should fetch next page when pagination is clicked', async () => {
    const page1Response: ResponseBody<TrusteeSummary[]> = {
      data: Array.from({ length: 25 }, (_, i) => ({
        id: `doc-${i}`,
        trusteeId: `trustee-${i}`,
        name: `Trustee ${i}`,
      })),
      pagination: { count: 25, totalCount: 50, currentPage: 1, totalPages: 2, limit: 25 },
    };
    const page2Response: ResponseBody<TrusteeSummary[]> = {
      data: [{ id: 'doc-25', trusteeId: 'trustee-25', name: 'Page Two Trustee' }],
      pagination: { count: 1, totalCount: 50, currentPage: 2, totalPages: 2, limit: 25 },
    };
    const spy = vi
      .spyOn(Api2, 'getSoftwareTrustees')
      .mockResolvedValueOnce(page1Response)
      .mockResolvedValueOnce(page2Response);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument();
    });

    const nextPageButton = screen.getByRole('button', { name: /next/i });
    await nextPageButton.click();

    await waitFor(() => {
      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenLastCalledWith('sw-1', 25, 25);
    });
  });
});
