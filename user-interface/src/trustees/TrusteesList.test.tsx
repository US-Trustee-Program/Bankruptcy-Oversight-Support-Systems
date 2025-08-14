import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import TrusteesList from './TrusteesList';
import Api2 from '@/lib/models/api2';
import { Trustee } from '@common/cams/parties';
import { ResponseBody } from '@common/api/response';
import { vi } from 'vitest';

function renderWithRouter(component: React.ReactElement) {
  return render(<BrowserRouter>{component}</BrowserRouter>);
}

describe('TrusteesList Component', () => {
  const mockTrustees: Trustee[] = [
    {
      id: 'trustee-1',
      name: 'John Doe',
      address1: '123 Main St',
      cityStateZipCountry: 'New York, NY, 10001, US',
      districts: ['NY'],
      chapters: ['7-panel', '11'],
      status: 'active',
      phone: '555-123-4567',
      email: 'john.doe@example.com',
      updatedOn: '2025-08-14T10:00:00Z',
      updatedBy: { id: 'user-1', name: 'Admin User' },
    },
    {
      id: 'trustee-2',
      name: 'Jane Smith',
      address1: '456 Oak Ave',
      cityStateZipCountry: 'Los Angeles, CA, 90210, US',
      districts: ['CA'],
      chapters: ['13'],
      status: 'not active',
      phone: '555-987-6543',
      email: 'jane.smith@example.com',
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
    expect(screen.getByText('NY')).toBeInTheDocument();
    expect(screen.getByText('CA')).toBeInTheDocument();
    expect(screen.getByText('7-panel, 11')).toBeInTheDocument();
    expect(screen.getByText('13')).toBeInTheDocument();
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

  test('should display status tags with appropriate styling', async () => {
    const mockResponse: ResponseBody<Trustee[]> = {
      data: mockTrustees,
    };

    vi.spyOn(Api2, 'getTrustees').mockResolvedValue(mockResponse);

    renderWithRouter(<TrusteesList />);

    await waitFor(() => {
      expect(screen.getByText('active')).toBeInTheDocument();
    });

    const activeTag = screen.getByText('active');
    expect(activeTag).toHaveClass('usa-tag--green');

    const notActiveTag = screen.getByText('Not active');
    expect(notActiveTag).toHaveClass('usa-tag--red');
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
      id: 'trustee-minimal',
      name: 'Minimal Trustee',
      address1: '789 Pine St',
      cityStateZipCountry: 'Chicago, IL, 60601, US',
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

    expect(screen.getByText('No districts assigned')).toBeInTheDocument();
    expect(screen.getByText('No chapters assigned')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument(); // Default status
  });
});
