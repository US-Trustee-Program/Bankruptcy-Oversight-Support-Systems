import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import TrusteesList from './TrusteesList';
import Api2 from '@/lib/models/api2';
import { Trustee } from '@common/cams/trustees';
import { ResponseBody } from '@common/api/response';
import { vi } from 'vitest';
import MockData from '@common/cams/test-utilities/mock-data';
import React from 'react';

function renderWithRouter(component: React.ReactElement) {
  return render(<BrowserRouter>{component}</BrowserRouter>);
}

describe('TrusteesList Component', () => {
  const mockTrustees: Trustee[] = [
    {
      id: '--id-guid-1--',
      trusteeId: 'trustee-1',
      name: 'John Doe',
      public: {
        address: MockData.getAddress(),
        phone: { number: '555-123-4567' },
        email: 'john.doe@example.com',
      },
      assistant: null,
      updatedOn: '2025-08-14T10:00:00Z',
      updatedBy: { id: 'user-1', name: 'Admin User' },
    },
    {
      id: '--id-guid-2--',
      trusteeId: 'trustee-2',
      name: 'Jane Smith',
      public: {
        address: MockData.getAddress(),
        phone: { number: '555-987-6543' },
        email: 'jane.smith@example.com',
      },
      assistant: null,
      updatedOn: '2025-08-14T09:00:00Z',
      updatedBy: { id: 'user-2', name: 'Admin User 2' },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should display loading spinner while fetching trustees', () => {
    vi.spyOn(Api2, 'getTrustees').mockImplementation(
      () =>
        new Promise(() => {
          // Never resolve to keep loading state
        }),
    );

    renderWithRouter(<TrusteesList />);

    expect(screen.getByText('Loading trustees...')).toBeInTheDocument();
  });

  test('should display trustees list when data is loaded', async () => {
    const mockResponse: ResponseBody<Trustee[]> = {
      data: mockTrustees,
    };

    vi.spyOn(Api2, 'getTrustees').mockResolvedValue(mockResponse);

    renderWithRouter(<TrusteesList />);

    await waitFor(() => {
      expect(screen.getByTestId('trustees-table')).toBeInTheDocument();
    });

    expect(screen.getByTestId('trustees-table')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  test('should display links to individual trustee profiles', async () => {
    const mockResponse: ResponseBody<Trustee[]> = {
      data: mockTrustees,
    };

    vi.spyOn(Api2, 'getTrustees').mockResolvedValue(mockResponse);

    renderWithRouter(<TrusteesList />);

    await waitFor(() => {
      expect(screen.getByTestId('trustee-link-trustee-1')).toBeInTheDocument();
    });

    const johnDoeLink = screen.getByTestId('trustee-link-trustee-1');
    expect(johnDoeLink).toHaveAttribute('href', '/trustees/trustee-1');

    const janeSmithLink = screen.getByTestId('trustee-link-trustee-2');
    expect(janeSmithLink).toHaveAttribute('href', '/trustees/trustee-2');
  });

  test('should display empty state when no trustees exist', async () => {
    const mockResponse: ResponseBody<Trustee[]> = {
      data: [],
    };

    vi.spyOn(Api2, 'getTrustees').mockResolvedValue(mockResponse);

    renderWithRouter(<TrusteesList />);

    await waitFor(() => {
      expect(screen.getByText('No trustees found')).toBeInTheDocument();
    });

    expect(screen.getByText(/No trustee profiles have been created yet/)).toBeInTheDocument();
    expect(screen.queryByTestId('trustees-table')).not.toBeInTheDocument();
  });

  test('should display error state when API call fails', async () => {
    vi.spyOn(Api2, 'getTrustees').mockRejectedValue(new Error('API Error'));

    renderWithRouter(<TrusteesList />);

    await waitFor(() => {
      expect(screen.getByText('Error loading trustees')).toBeInTheDocument();
    });

    expect(
      screen.getByText('Failed to load trustees. Please try again later.'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('trustees-table')).not.toBeInTheDocument();
  });

  test('should handle trustees with missing optional fields', async () => {
    const minimalTrustee: Trustee = {
      id: '--id-guid-min--',
      trusteeId: 'trustee-minimal',
      name: 'Minimal Trustee',
      public: {
        address: MockData.getAddress(),
        phone: { number: '555-1234' },
        email: 'jane.doe@example.com',
      },
      assistant: null,
      updatedOn: '2025-08-14T08:00:00Z',
      updatedBy: { id: 'user-3', name: 'Admin User 3' },
    };

    const mockResponse: ResponseBody<Trustee[]> = {
      data: [minimalTrustee],
    };

    vi.spyOn(Api2, 'getTrustees').mockResolvedValue(mockResponse);

    renderWithRouter(<TrusteesList />);

    await waitFor(() => {
      expect(screen.getByText('Minimal Trustee')).toBeInTheDocument();
    });
  });

  test('should handle API response with undefined data field', async () => {
    const mockResponse: ResponseBody<Trustee[]> = {
      data: undefined as unknown as Trustee[],
    };

    vi.spyOn(Api2, 'getTrustees').mockResolvedValue(mockResponse);

    renderWithRouter(<TrusteesList />);

    await waitFor(() => {
      expect(screen.getByText('No trustees found')).toBeInTheDocument();
    });

    expect(screen.getByText(/No trustee profiles have been created yet/)).toBeInTheDocument();
  });
});
