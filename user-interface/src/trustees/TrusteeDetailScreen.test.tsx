import { render, screen, waitFor } from '@testing-library/react';
import { vi, beforeEach } from 'vitest';
import useApi2 from '@/lib/hooks/UseApi2';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import { UswdsTagStyle } from '@/lib/components/uswds/Tag';
import TrusteeDetailScreen from './TrusteeDetailScreen';

// Mock the hooks and dependencies
const mockUseParams = vi.hoisted(() => vi.fn());
const mockUseNavigate = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', () => ({
  useParams: mockUseParams,
  useNavigate: mockUseNavigate,
}));

vi.mock('@/lib/hooks/UseApi2');
vi.mock('@/lib/hooks/UseGlobalAlert');
const mockUseApi2 = vi.mocked(useApi2);
const mockUseGlobalAlert = vi.mocked(useGlobalAlert);

const mockTrustee = {
  id: '123',
  name: 'John Doe',
  public: {
    address: {
      address1: '123 Main St',
      city: 'Anytown',
      state: 'NY',
      zipCode: '12345',
    },
    phone: { number: '555-123-4567' },
    email: 'john.doe@example.com',
  },
  districts: ['NYEB', 'NYWB'],
  chapters: ['7-panel', '11', '13'],
  status: 'active',
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

beforeEach(() => {
  vi.clearAllMocks();
  mockUseParams.mockReturnValue({ trusteeId: '123' });
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  mockUseApi2.mockReturnValue(mockApi as any); // Cast to any to avoid type complexity in tests
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  mockUseGlobalAlert.mockReturnValue(mockGlobalAlert as any); // Cast to any to avoid type complexity in tests
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
  mockGetTrustee.mockResolvedValue({ data: mockTrustee });
  mockGetCourts.mockResolvedValue({ data: mockCourts });

  render(<TrusteeDetailScreen />);

  // Use getByRole to specifically target the h1 heading
  await waitFor(() => {
    expect(screen.getByRole('heading', { level: 1, name: 'John Doe' })).toBeInTheDocument();
  });

  expect(screen.getByText('123 Main St')).toBeInTheDocument();
  expect(screen.getByText('Anytown')).toBeInTheDocument();
  expect(screen.getByText(', NY')).toBeInTheDocument();
  expect(screen.getByText(/12345/)).toBeInTheDocument();
  expect(screen.getByText('555-123-4567')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /john\.doe@example\.com/ })).toBeInTheDocument();
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

test('should render email link with correct mailto href', async () => {
  mockGetTrustee.mockResolvedValue({ data: mockTrustee });
  mockGetCourts.mockResolvedValue({ data: mockCourts });

  render(<TrusteeDetailScreen />);

  await waitFor(() => {
    const emailLink = screen.getByRole('link', { name: /john\.doe@example\.com/ });
    expect(emailLink).toHaveAttribute('href', 'mailto:john.doe@example.com');
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
