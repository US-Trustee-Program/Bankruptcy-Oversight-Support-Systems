import { render, screen, waitFor } from '@testing-library/react';
import { vi, beforeEach } from 'vitest';
import useApi2 from '@/lib/hooks/UseApi2';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import { UswdsTagStyle } from '@/lib/components/uswds/Tag';
import TrusteeDetailScreen from './TrusteeDetailScreen';
import { Trustee } from '@common/cams/trustees';
import { ContactInformation } from '@common/cams/contact';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';

// Mock the hooks and dependencies
const mockUseParams = vi.hoisted(() => vi.fn());
const mockUseNavigate = vi.hoisted(() => vi.fn());
const mockUseLocation = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', () => ({
  useParams: mockUseParams,
  useNavigate: mockUseNavigate,
  useLocation: mockUseLocation,
}));

vi.mock('@/lib/hooks/UseApi2');
vi.mock('@/lib/hooks/UseGlobalAlert');
const mockUseApi2 = vi.mocked(useApi2);
const mockUseGlobalAlert = vi.mocked(useGlobalAlert);

const mockTrustee: Trustee = {
  id: '123',
  name: 'John Doe',
  public: {
    address: {
      address1: '123 Main St',
      address2: 'c/o John Smith',
      address3: 'Ch 7',
      city: 'Anytown',
      state: 'NY',
      zipCode: '12345',
      countryCode: 'US',
    },
    phone: { number: '555-123-4567', extension: '1234' },
    email: 'john.doe.public@example.com',
  },
  districts: ['NYEB', 'NYWB'],
  chapters: ['7-panel', '11', '13'],
  status: 'active',
  updatedBy: SYSTEM_USER_REFERENCE,
  updatedOn: '2025-08-14T10:00:00Z',
  createdBy: SYSTEM_USER_REFERENCE,
  createdOn: '2025-08-14T09:00:00Z',
};

const mockInternal: ContactInformation = {
  address: {
    address1: '9876 2nd Ave',
    address2: 'c/o John Smith',
    address3: 'Ch 7',
    city: 'Specific Town',
    state: 'NJ',
    zipCode: '02345',
    countryCode: 'US',
  },
  phone: { number: '111-123-4567', extension: '4578' },
  email: 'john.doe.private@example.com',
};

const mockCourts = [
  {
    courtDivisionCode: 'NYEB',
    courtName: 'Eastern District of New York',
    courtDivisionName: 'Brooklyn',
  },
  {
    courtDivisionCode: 'NYWB',
    courtName: 'Western District of New York',
    courtDivisionName: 'Buffalo',
  },
];

// Create mock functions
const mockGetTrustee = vi.fn();
const mockGetCourts = vi.fn();

const mockApi = {
  getTrustee: mockGetTrustee,
  getCourts: mockGetCourts,
};

const mockGlobalAlert = {
  error: vi.fn(),
  show: vi.fn(),
  info: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
};

describe('TrusteeDetailScreen', () => {
  beforeEach(() => {
    mockUseParams.mockReturnValue({ trusteeId: '123' });
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    mockUseApi2.mockReturnValue(mockApi as any); // Cast to any to avoid type complexity in tests
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    mockUseGlobalAlert.mockReturnValue(mockGlobalAlert as any); // Cast to any to avoid type complexity in tests
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should display loading spinner while fetching data', async () => {
    // Mock the API to delay resolution so we can test loading state
    mockGetTrustee.mockImplementation(() => new Promise(() => {})); // Never resolves
    mockGetCourts.mockImplementation(() => new Promise(() => {}));

    render(<TrusteeDetailScreen />);

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument(); // LoadingSpinner now has role="status"
      expect(screen.getByText('Trustee Details')).toBeInTheDocument(); // Loading header
    });
  });

  test('should render trustee details when data is loaded', async () => {
    mockGetTrustee.mockResolvedValue({ data: { ...mockTrustee, internal: mockInternal } });
    mockGetCourts.mockResolvedValue({ data: mockCourts });

    render(<TrusteeDetailScreen />);

    // Use getByRole to specifically target the h1 heading
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'John Doe' })).toBeInTheDocument();
    });

    expect(screen.getByText(mockTrustee.public.address.address1)).toBeInTheDocument();
    expect(screen.getByText(mockTrustee.public.address.address2!)).toBeInTheDocument();
    expect(screen.getByText(mockTrustee.public.address.address3!)).toBeInTheDocument();
    expect(screen.getByText(mockTrustee.public.address.city)).toBeInTheDocument();
    expect(screen.getByText(`, ${mockTrustee.public.address.state}`)).toBeInTheDocument();
    expect(screen.getByText(mockTrustee.public.address.zipCode)).toBeInTheDocument();
    expect(screen.queryByTestId(mockTrustee.public.address.countryCode)).not.toBeInTheDocument();
    expect(screen.getByText(new RegExp(mockTrustee.public.phone!.number))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: mockTrustee.public.email })).toBeInTheDocument();

    expect(screen.getByText(mockInternal.address.address1)).toBeInTheDocument();
    expect(screen.getByText(mockInternal.address.address2!)).toBeInTheDocument();
    expect(screen.getByText(mockInternal.address.address3!)).toBeInTheDocument();
    expect(screen.getByText(mockInternal.address.city)).toBeInTheDocument();
    expect(screen.getByText(`, ${mockInternal.address.state}`)).toBeInTheDocument();
    expect(screen.getByText(mockInternal.address.zipCode)).toBeInTheDocument();
    expect(screen.queryByTestId(mockInternal.address.countryCode)).not.toBeInTheDocument();
    expect(screen.getByText(new RegExp(mockInternal.phone!.number))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: mockInternal.email })).toBeInTheDocument();
  });

  test('should render district tags with court names', async () => {
    mockGetTrustee.mockResolvedValue({ data: mockTrustee });
    mockGetCourts.mockResolvedValue({ data: mockCourts });

    render(<TrusteeDetailScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('tag-district-0')).toHaveTextContent(
        'Eastern District of New York (Brooklyn)',
      );
    });

    expect(screen.getByTestId('tag-district-1')).toHaveTextContent(
      'Western District of New York (Buffalo)',
    );
  });

  test('should render chapter tags with formatted names', async () => {
    mockGetTrustee.mockResolvedValue({ data: mockTrustee });
    mockGetCourts.mockResolvedValue({ data: mockCourts });

    render(<TrusteeDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Chapter 7 - Panel')).toBeInTheDocument();
    });

    expect(screen.getByText('Chapter 11')).toBeInTheDocument();
    expect(screen.getByText('Chapter 13')).toBeInTheDocument();
  });

  test('should render status tag with formatted status', async () => {
    mockGetTrustee.mockResolvedValue({ data: mockTrustee });
    mockGetCourts.mockResolvedValue({ data: mockCourts });

    render(<TrusteeDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument();
    });
  });

  test('should format "not active" status correctly', async () => {
    const inactiveTrustee = { ...mockTrustee, status: 'not active' };
    mockGetTrustee.mockResolvedValue({ data: inactiveTrustee });
    mockGetCourts.mockResolvedValue({ data: mockCourts });

    render(<TrusteeDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Not Active')).toBeInTheDocument();
    });
  });

  test('should handle trustee without email', async () => {
    const trusteeWithoutEmail = {
      ...mockTrustee,
      public: { ...mockTrustee.public, email: undefined },
    };
    mockGetTrustee.mockResolvedValue({ data: trusteeWithoutEmail });
    mockGetCourts.mockResolvedValue({ data: mockCourts });

    render(<TrusteeDetailScreen />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'John Doe' })).toBeInTheDocument();
    });

    expect(screen.queryByTestId('trustee-email')).not.toBeInTheDocument();
  });

  test('should handle trustee without address', async () => {
    const trusteeWithoutAddress = {
      ...mockTrustee,
      public: { ...mockTrustee.public, address: undefined },
    };
    mockGetTrustee.mockResolvedValue({ data: trusteeWithoutAddress });
    mockGetCourts.mockResolvedValue({ data: mockCourts });

    render(<TrusteeDetailScreen />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'John Doe' })).toBeInTheDocument();
    });

    expect(screen.queryByText('123 Main St')).not.toBeInTheDocument();
  });

  test('should handle API errors gracefully', async () => {
    // Suppress console errors for this test to prevent unhandled rejection noise
    const originalConsoleError = console.error;
    console.error = vi.fn();

    // Mock API call to reject
    mockGetTrustee.mockRejectedValue(new Error('API Error'));
    mockGetCourts.mockResolvedValue({ data: mockCourts });

    render(<TrusteeDetailScreen />);

    // The component should still render the basic structure
    await waitFor(() => {
      expect(screen.getByTestId('trustee-detail-screen')).toBeInTheDocument();
      expect(screen.getByText('Trustee Details')).toBeInTheDocument(); // Loading/error header
    });

    // Wait for the error handling to complete and check that global alert was called
    await waitFor(() => {
      expect(mockGlobalAlert.error).toHaveBeenCalledWith('Could not get trustee details');
    });

    // After error, trustee remains null so loading UI is still shown (this is expected behavior)
    expect(screen.getByRole('status')).toBeInTheDocument(); // Loading spinner still shows because !trustee
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument(); // No trustee name

    // Restore console.error
    console.error = originalConsoleError;
  });

  test('should render plural "Chapters" when trustee has multiple chapters', async () => {
    mockGetTrustee.mockResolvedValue({ data: mockTrustee });
    mockGetCourts.mockResolvedValue({ data: mockCourts });

    render(<TrusteeDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText(/Chapters:/)).toBeInTheDocument();
    });
  });

  test('should render singular "Chapter" when trustee has one chapter', async () => {
    const trusteeWithOneChapter = { ...mockTrustee, chapters: ['11'] };
    mockGetTrustee.mockResolvedValue({ data: trusteeWithOneChapter });
    mockGetCourts.mockResolvedValue({ data: mockCourts });

    render(<TrusteeDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText(/^Chapter:/)).toBeInTheDocument();
    });
  });

  test('should render basic structure when no trusteeId is provided', () => {
    mockUseParams.mockReturnValue({});

    render(<TrusteeDetailScreen />);

    // Component should render basic structure even without trusteeId
    expect(screen.getByTestId('trustee-detail-screen')).toBeInTheDocument();
    // Should show loading state since no data will be fetched
    expect(screen.getByText('Trustee Details')).toBeInTheDocument();
  });

  test('should format chapter type correctly for subchapter V', async () => {
    const trusteeWithSubchapterV = { ...mockTrustee, chapters: ['11-subchapter-v'] };
    mockGetTrustee.mockResolvedValue({ data: trusteeWithSubchapterV });
    mockGetCourts.mockResolvedValue({ data: mockCourts });

    render(<TrusteeDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Chapter 11 - Subchapter V')).toBeInTheDocument();
    });
  });

  test('should handle unknown chapter types', async () => {
    const trusteeWithUnknownChapter = { ...mockTrustee, chapters: ['unknown-chapter'] };
    mockGetTrustee.mockResolvedValue({ data: trusteeWithUnknownChapter });
    mockGetCourts.mockResolvedValue({ data: mockCourts });

    render(<TrusteeDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Chapter unknown-chapter')).toBeInTheDocument();
    });
  });

  test('should render email links with correct mailto href', async () => {
    mockGetTrustee.mockResolvedValue({ data: { ...mockTrustee, internal: mockInternal } });
    mockGetCourts.mockResolvedValue({ data: mockCourts });

    render(<TrusteeDetailScreen />);

    await waitFor(() => {
      const emailLink = screen.getByRole('link', { name: mockTrustee.public.email });
      expect(emailLink).toHaveAttribute('href', `mailto:${mockTrustee.public.email}`);
      const internalEmailLink = screen.getByRole('link', { name: mockInternal.email });
      expect(internalEmailLink).toHaveAttribute('href', `mailto:${mockInternal.email}`);
    });
  });

  test.each([
    ['active', UswdsTagStyle.Green],
    ['suspended', UswdsTagStyle.SecondaryDark],
    ['', UswdsTagStyle.BaseDarkest],
  ])(
    'should format trustee status color for status "%s" with style "%s"',
    async (status, expectedStyle) => {
      const testTrustee = { ...mockTrustee, status };
      mockGetTrustee.mockResolvedValue({ data: testTrustee });
      mockGetCourts.mockResolvedValue({ data: mockCourts });

      render(<TrusteeDetailScreen />);

      await waitFor(() => {
        const statusTag = screen.getByTestId('tag-trustee-status');
        expect(statusTag).toHaveClass(expectedStyle);
      });
    },
  );
});
