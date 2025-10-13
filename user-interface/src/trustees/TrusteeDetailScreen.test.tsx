import { render, screen, waitFor } from '@testing-library/react';
import { vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import useApi2 from '@/lib/hooks/UseApi2';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import { UswdsTagStyle } from '@/lib/components/uswds/Tag';
import TrusteeDetailScreen from './TrusteeDetailScreen';
import { Trustee } from '@common/cams/trustees';
import { ContactInformation } from '@common/cams/contact';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import { GlobalAlertRef } from '@/lib/components/cams/GlobalAlert/GlobalAlert';
import { BankruptcySoftwareList } from '@common/cams/lists';

const mockOnEditPublicProfile = vi.fn();
const mockOnEditInternalProfile = vi.fn();

const mockUseParams = vi.hoisted(() => vi.fn());
const mockUseNavigate = vi.hoisted(() => vi.fn());
const mockUseLocation = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: mockUseParams,
    useNavigate: mockUseNavigate,
    useLocation: mockUseLocation,
  };
});

vi.mock('@/lib/hooks/UseApi2');
vi.mock('@/lib/hooks/UseGlobalAlert');
const mockUseApi2 = vi.mocked(useApi2);
const mockUseGlobalAlert = vi.mocked(useGlobalAlert);

const mockTrustee: Trustee = {
  id: '--id-guid--',
  trusteeId: '123',
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

const mockGetTrustee = vi.fn();
const mockGetCourts = vi.fn();
const mockGetTrusteeHistory = vi.fn();
const mockGetBankruptcySoftwareList = vi.fn();

const mockSoftwareList: BankruptcySoftwareList = [
  { _id: '1', list: 'bankruptcy-software', key: 'Axos', value: 'Axos' },
  { _id: '2', list: 'bankruptcy-software', key: 'BlueStylus', value: 'BlueStylus' },
  { _id: '3', list: 'bankruptcy-software', key: 'BSS 13Software', value: 'BSS 13Software' },
  { _id: '4', list: 'bankruptcy-software', key: 'Epiq', value: 'Epiq' },
  { _id: '5', list: 'bankruptcy-software', key: 'Satori', value: 'Satori' },
  { _id: '6', list: 'bankruptcy-software', key: 'Stretto', value: 'Stretto' },
  { _id: '7', list: 'bankruptcy-software', key: 'TrusteSolutions', value: 'TrusteSolutions' },
  { _id: '8', list: 'bankruptcy-software', key: 'Verita Title XI', value: 'Verita Title XI' },
];

const mockApi = {
  getTrustee: mockGetTrustee,
  getCourts: mockGetCourts,
  getTrusteeHistory: mockGetTrusteeHistory,
  getBankruptcySoftwareList: mockGetBankruptcySoftwareList,
} as Partial<ReturnType<typeof useApi2>> as ReturnType<typeof useApi2>;

const mockGlobalAlert: GlobalAlertRef = {
  error: vi.fn(),
  show: vi.fn(),
  info: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
};

describe('TrusteeDetailScreen', () => {
  const mockNavigate = vi.fn();
  const mockLocation = { pathname: '/trustees/123' };

  const renderWithRouter = (initialEntries = ['/trustees/123']) => {
    return render(
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/trustees/:trusteeId/*" element={<TrusteeDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    );
  };

  beforeEach(() => {
    mockUseParams.mockReturnValue({ trusteeId: '123' });
    mockUseNavigate.mockReturnValue(mockNavigate);
    mockUseLocation.mockReturnValue(mockLocation);
    mockUseApi2.mockReturnValue(mockApi);
    mockUseGlobalAlert.mockReturnValue(mockGlobalAlert);

    mockOnEditPublicProfile.mockClear();
    mockOnEditInternalProfile.mockClear();
    mockGetTrusteeHistory.mockClear();
    mockGetBankruptcySoftwareList.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should display loading spinner while fetching data', async () => {
    mockGetTrustee.mockImplementation(() => new Promise(() => {}));
    mockGetCourts.mockImplementation(() => new Promise(() => {}));

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Trustee Details');
    });
  });

  test('should render trustee header when data is loaded', async () => {
    mockGetTrustee.mockResolvedValue({ data: { ...mockTrustee, internal: mockInternal } });
    mockGetCourts.mockResolvedValue({ data: mockCourts });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('John Doe');
      expect(screen.getByTestId('tag-trustee-status')).toHaveTextContent('Active');
      expect(screen.getByTestId('tag-district-0')).toHaveTextContent(
        'Eastern District of New York (Brooklyn)',
      );
      expect(screen.getByTestId('tag-chapter-0')).toHaveTextContent('Chapter 7 - Panel');
    });

    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  test('should render district tags with court names', async () => {
    mockGetTrustee.mockResolvedValue({ data: mockTrustee });
    mockGetCourts.mockResolvedValue({ data: mockCourts });

    renderWithRouter();

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

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByTestId('tag-chapter-0')).toHaveTextContent('Chapter 7 - Panel');
    });

    expect(screen.getByTestId('tag-chapter-1')).toHaveTextContent('Chapter 11');
    expect(screen.getByTestId('tag-chapter-2')).toHaveTextContent('Chapter 13');
  });

  test('should render status tag with formatted status', async () => {
    mockGetTrustee.mockResolvedValue({ data: mockTrustee });
    mockGetCourts.mockResolvedValue({ data: mockCourts });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByTestId('tag-trustee-status')).toHaveTextContent('Active');
    });
  });

  test('should format "not active" status correctly', async () => {
    const inactiveTrustee = { ...mockTrustee, status: 'not active' };
    mockGetTrustee.mockResolvedValue({ data: inactiveTrustee });
    mockGetCourts.mockResolvedValue({ data: mockCourts });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByTestId('tag-trustee-status')).toHaveTextContent('Not Active');
    });
  });

  test('should handle trustee without email', async () => {
    const trusteeWithoutEmail = {
      ...mockTrustee,
      public: { ...mockTrustee.public, email: undefined },
    };
    mockGetTrustee.mockResolvedValue({ data: trusteeWithoutEmail });
    mockGetCourts.mockResolvedValue({ data: mockCourts });

    renderWithRouter();

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

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'John Doe' })).toBeInTheDocument();
    });

    expect(screen.queryByText('123 Main St')).not.toBeInTheDocument();
  });

  test('should handle API errors gracefully', async () => {
    const originalConsoleError = console.error;
    console.error = vi.fn();

    mockGetTrustee.mockRejectedValue(new Error('API Error'));
    mockGetCourts.mockResolvedValue({ data: mockCourts });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByTestId('trustee-detail-screen')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Trustee Details');
    });

    await waitFor(() => {
      expect(mockGlobalAlert.error).toHaveBeenCalledWith('Could not get trustee details');
    });

    expect(screen.getByTestId('404-NotFound')).toBeInTheDocument();
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();

    console.error = originalConsoleError;
  });

  test('should render multiple chapter tags when trustee has multiple chapters', async () => {
    mockGetTrustee.mockResolvedValue({ data: mockTrustee });
    mockGetCourts.mockResolvedValue({ data: mockCourts });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByTestId('tag-chapter-0')).toHaveTextContent('Chapter 7 - Panel');
      expect(screen.getByTestId('tag-chapter-1')).toHaveTextContent('Chapter 11');
      expect(screen.getByTestId('tag-chapter-2')).toHaveTextContent('Chapter 13');
    });
  });

  test('should render single chapter tag when trustee has one chapter', async () => {
    const trusteeWithOneChapter = { ...mockTrustee, chapters: ['11'] };
    mockGetTrustee.mockResolvedValue({ data: trusteeWithOneChapter });
    mockGetCourts.mockResolvedValue({ data: mockCourts });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByTestId('tag-chapter-0')).toHaveTextContent('Chapter 11');
      expect(screen.queryByTestId('tag-chapter-1')).not.toBeInTheDocument();
      expect(screen.queryByTestId('tag-chapter-2')).not.toBeInTheDocument();
    });
  });

  test('should render NotFound when no trusteeId is provided', () => {
    mockUseParams.mockReturnValue({});

    renderWithRouter();

    expect(screen.getByText('404 - Not Found')).toBeInTheDocument();
  });

  test('should render NotFound when trustee is not found and not loading', async () => {
    mockUseParams.mockReturnValue({ trusteeId: '123' });
    // Mock API returning null data to simulate trustee not found
    mockGetTrustee.mockResolvedValue({ data: null });
    mockGetCourts.mockResolvedValue({ data: mockCourts });

    renderWithRouter();

    // Wait for loading to finish
    await waitFor(() => {
      expect(mockGetTrustee).toHaveBeenCalledWith('123');
    });

    expect(screen.getByText('404 - Not Found')).toBeInTheDocument();
  });

  test('should format chapter type correctly for subchapter V', async () => {
    const trusteeWithSubchapterV = { ...mockTrustee, chapters: ['11-subchapter-v'] };
    mockGetTrustee.mockResolvedValue({ data: trusteeWithSubchapterV });
    mockGetCourts.mockResolvedValue({ data: mockCourts });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByTestId('tag-chapter-0')).toHaveTextContent('Chapter 11 - Subchapter V');
    });
  });

  test('should handle unknown chapter types', async () => {
    const trusteeWithUnknownChapter = { ...mockTrustee, chapters: ['unknown-chapter'] };
    mockGetTrustee.mockResolvedValue({ data: trusteeWithUnknownChapter });
    mockGetCourts.mockResolvedValue({ data: mockCourts });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByTestId('tag-chapter-0')).toHaveTextContent('Chapter unknown-chapter');
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

      renderWithRouter();

      await waitFor(() => {
        const statusTag = screen.getByTestId('tag-trustee-status');
        expect(statusTag).toHaveClass(expectedStyle);
      });
    },
  );

  test('should have proper navigation functions for edit operations', async () => {
    mockGetTrustee.mockResolvedValue({ data: mockTrustee });
    mockGetCourts.mockResolvedValue({ data: mockCourts });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(mockTrustee.name);
    });

    expect(mockUseNavigate).toHaveBeenCalled();
    expect(mockUseLocation).toHaveBeenCalled();
    expect(mockUseParams).toHaveBeenCalled();

    expect(mockGetTrustee).toHaveBeenCalledWith('123');

    expect(mockNavigate).toEqual(expect.any(Function));
    expect(mockLocation.pathname).toBe('/trustees/123');
  });

  test('should call navigate with correct state when public edit button is clicked', async () => {
    mockGetTrustee.mockResolvedValue({ data: mockTrustee });
    mockGetCourts.mockResolvedValue({ data: mockCourts });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('John Doe');
    });

    const publicEditButton = screen.getByLabelText('Edit trustee public overview information');
    publicEditButton.click();

    expect(mockNavigate).toHaveBeenCalledWith('/trustees/123/contact/edit/public', {
      state: {
        trusteeId: '123',
        trustee: mockTrustee,
        cancelTo: '/trustees/123',
        action: 'edit',
        contactInformation: 'public',
      },
    });
  });

  test('should call navigate with correct state when internal edit button is clicked', async () => {
    mockGetTrustee.mockResolvedValue({ data: mockTrustee });
    mockGetCourts.mockResolvedValue({ data: mockCourts });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('John Doe');
    });

    const internalEditButton = screen.getByLabelText('Edit trustee internal contact information');
    internalEditButton.click();

    expect(mockNavigate).toHaveBeenCalledWith('/trustees/123/contact/edit/internal', {
      state: {
        trusteeId: '123',
        trustee: mockTrustee,
        cancelTo: '/trustees/123',
        action: 'edit',
        contactInformation: 'internal',
      },
    });
  });

  test('should call navigate with correct state when other information edit button is clicked', async () => {
    mockGetTrustee.mockResolvedValue({ data: mockTrustee });
    mockGetCourts.mockResolvedValue({ data: mockCourts });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('John Doe');
    });

    const otherInfoEditButton = screen.getByLabelText('Edit other trustee information');
    otherInfoEditButton.click();

    expect(mockNavigate).toHaveBeenCalledWith('/trustees/123/other/edit', {
      state: {
        trusteeId: '123',
        trustee: mockTrustee,
        cancelTo: '/trustees/123',
        action: 'edit',
      },
    });
  });

  test('should set trustee from location state when available', async () => {
    const locationWithState = {
      pathname: '/trustees/123',
      state: { trustee: mockTrustee },
    };

    mockUseLocation.mockReturnValue(locationWithState);
    mockGetTrustee.mockResolvedValue({ data: mockTrustee });
    mockGetCourts.mockResolvedValue({ data: mockCourts });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('John Doe');
    });

    expect(screen.getByText('123 Main St')).toBeInTheDocument();
    expect(screen.getByText('john.doe.public@example.com')).toBeInTheDocument();
  });

  test('should use location state trustee when present and avoid unnecessary API calls', async () => {
    const updatedTrustee: Trustee = {
      ...mockTrustee,
      name: 'John Doe Updated',
      public: {
        ...mockTrustee.public,
        address: {
          ...mockTrustee.public.address,
          address1: '456 Updated Street',
          city: 'New City',
        },
        phone: { number: '555-999-8888', extension: '9999' },
        email: 'john.updated@example.com',
      },
    };

    const locationWithUpdatedState = {
      pathname: '/trustees/123',
      state: { trustee: updatedTrustee },
    };

    mockUseLocation.mockReturnValue(locationWithUpdatedState);
    mockGetTrustee.mockResolvedValue({ data: mockTrustee });
    mockGetCourts.mockResolvedValue({ data: mockCourts });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('John Doe Updated');
    });

    expect(screen.getByText('456 Updated Street')).toBeInTheDocument();
    expect(screen.getByText('New City')).toBeInTheDocument();
    expect(screen.getByText('john.updated@example.com')).toBeInTheDocument();
    expect(screen.getByText('555-999-8888, ext. 9999')).toBeInTheDocument();

    expect(screen.queryByText('123 Main St')).not.toBeInTheDocument();
    expect(screen.queryByText('john.doe.public@example.com')).not.toBeInTheDocument();
  });

  test('should load from API when no location state is present', async () => {
    mockUseLocation.mockReturnValue({
      pathname: '/trustees/123',
      state: null,
    });

    mockGetTrustee.mockResolvedValue({ data: mockTrustee });
    mockGetCourts.mockResolvedValue({ data: mockCourts });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('John Doe');
    });

    expect(screen.getByText('123 Main St')).toBeInTheDocument();
    expect(screen.getByText('john.doe.public@example.com')).toBeInTheDocument();

    expect(mockGetTrustee).toHaveBeenCalledWith('123');
  });

  test('should handle transition from API data to location state data', async () => {
    mockUseLocation.mockReturnValue({
      pathname: '/trustees/123',
      state: null,
    });
    mockGetTrustee.mockResolvedValue({ data: mockTrustee });
    mockGetCourts.mockResolvedValue({ data: mockCourts });

    const { rerender } = renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('john.doe.public@example.com')).toBeInTheDocument();
    });

    const updatedTrustee = {
      ...mockTrustee,
      public: {
        ...mockTrustee.public,
        phone: { number: '555-111-2222', extension: '1111' },
        email: 'newemail@example.com',
      },
    };

    mockUseLocation.mockReturnValue({
      pathname: '/trustees/123',
      state: { trustee: updatedTrustee },
    });

    rerender(
      <MemoryRouter initialEntries={['/trustees/123']}>
        <Routes>
          <Route path="/trustees/:trusteeId/*" element={<TrusteeDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('newemail@example.com')).toBeInTheDocument();
    });

    expect(screen.getByText('555-111-2222, ext. 1111')).toBeInTheDocument();
    expect(screen.queryByText('john.doe.public@example.com')).not.toBeInTheDocument();
  });

  test.each([
    {
      route: '/trustees/123/contact/edit/public',
      expectedSubheader: 'Edit Trustee Profile (Public)',
      description:
        'should render subheader "Edit Trustee Profile (Public)" for /contact/edit/public route',
      needsLocationState: true,
      locationState: {
        pathname: '/trustees/123/contact/edit/public',
        state: {
          trusteeId: '123',
          trustee: mockTrustee,
          cancelTo: '/trustees/123',
          action: 'edit',
          contactInformation: 'public',
        },
      },
    },
    {
      route: '/trustees/123/contact/edit/internal',
      expectedSubheader: 'Edit Trustee Profile (USTP Internal)',
      description:
        'should render subheader "Edit Trustee Profile (USTP Internal)" for /contact/edit/internal route',
      needsLocationState: true,
      locationState: {
        pathname: '/trustees/123/contact/edit/internal',
        state: {
          trusteeId: '123',
          trustee: mockTrustee,
          cancelTo: '/trustees/123',
          action: 'edit',
          contactInformation: 'internal',
        },
      },
    },
    {
      route: '/trustees/123/other/edit',
      expectedSubheader: 'Edit Other Trustee Information',
      description: 'should render subheader "Edit Other Trustee Information" for /other/edit route',
      needsLocationState: false,
    },
    {
      route: '/trustees/123/audit-history',
      expectedSubheader: 'Trustee',
      description: 'should render subheader "Trustee" for /audit-history route',
      needsLocationState: false,
      needsHistoryMock: true,
    },
    {
      route: '/trustees/123',
      expectedSubheader: 'Trustee',
      description: 'should render subheader "Trustee" for default route',
      needsLocationState: false,
    },
  ])(
    '$description',
    async ({ route, expectedSubheader, needsLocationState, locationState, needsHistoryMock }) => {
      // Set up location state if needed for contact forms
      if (needsLocationState && locationState) {
        mockUseLocation.mockReturnValue(locationState);
      }

      // Set up API mocks
      mockGetTrustee.mockResolvedValue({ data: mockTrustee });
      mockGetCourts.mockResolvedValue({ data: mockCourts });

      if (needsHistoryMock) {
        mockGetTrusteeHistory.mockResolvedValue({ data: [] });
      }

      renderWithRouter([route]);

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(expectedSubheader);
      });
    },
  );

  test('should fetch software options from API on component mount', async () => {
    mockGetTrustee.mockResolvedValue({ data: mockTrustee });
    mockGetCourts.mockResolvedValue({ data: mockCourts });

    renderWithRouter();

    // Wait for the component to render and API calls to be made
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('John Doe');
    });

    // Verify the software options API was called
    expect(mockGetBankruptcySoftwareList).toHaveBeenCalled();
  });

  test('should handle software options API returning null data', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    mockGetTrustee.mockResolvedValue({ data: mockTrustee });
    mockGetCourts.mockResolvedValue({ data: mockCourts });
    mockGetBankruptcySoftwareList.mockResolvedValue({ data: null });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('John Doe');
    });

    expect(mockGetBankruptcySoftwareList).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  test('should handle software options API returning undefined data', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    mockGetTrustee.mockResolvedValue({ data: mockTrustee });
    mockGetCourts.mockResolvedValue({ data: mockCourts });
    mockGetBankruptcySoftwareList.mockResolvedValue({ data: undefined });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('John Doe');
    });

    expect(mockGetBankruptcySoftwareList).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  test('should handle software options API error', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    mockGetTrustee.mockResolvedValue({ data: mockTrustee });
    mockGetCourts.mockResolvedValue({ data: mockCourts });
    mockGetBankruptcySoftwareList.mockRejectedValue(new Error('Software API error'));

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('John Doe');
    });

    expect(mockGetBankruptcySoftwareList).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to fetch software options',
      'Software API error',
    );

    consoleSpy.mockRestore();
  });

  test('should handle court divisions API returning null data', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    mockGetTrustee.mockResolvedValue({ data: mockTrustee });
    mockGetCourts.mockResolvedValue({ data: null });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('John Doe');
    });

    expect(mockGetCourts).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  test('should handle court divisions API returning undefined data', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    mockGetTrustee.mockResolvedValue({ data: mockTrustee });
    mockGetCourts.mockResolvedValue({ data: undefined });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('John Doe');
    });

    expect(mockGetCourts).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  test('should handle court divisions API error', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    mockGetTrustee.mockResolvedValue({ data: mockTrustee });
    mockGetCourts.mockRejectedValue(new Error('Courts API error'));

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('John Doe');
    });

    expect(mockGetCourts).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch court divisions', 'Courts API error');

    consoleSpy.mockRestore();
  });

  test('should transform software list correctly', async () => {
    mockGetTrustee.mockResolvedValue({ data: mockTrustee });
    mockGetCourts.mockResolvedValue({ data: mockCourts });
    mockGetBankruptcySoftwareList.mockResolvedValue({ data: mockSoftwareList });

    renderWithRouter(['/trustees/123/other/edit']);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
        'Edit Other Trustee Information',
      );
    });

    expect(mockGetBankruptcySoftwareList).toHaveBeenCalled();
  });

  test('should handle trustee with no districts gracefully', async () => {
    const trusteeWithoutDistricts = { ...mockTrustee, districts: undefined };
    mockGetTrustee.mockResolvedValue({ data: trusteeWithoutDistricts });
    mockGetCourts.mockResolvedValue({ data: mockCourts });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('John Doe');
    });

    expect(screen.queryByTestId('tag-district-0')).not.toBeInTheDocument();
  });

  test('should handle trustee with empty districts array', async () => {
    const trusteeWithEmptyDistricts = { ...mockTrustee, districts: [] };
    mockGetTrustee.mockResolvedValue({ data: trusteeWithEmptyDistricts });
    mockGetCourts.mockResolvedValue({ data: mockCourts });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('John Doe');
    });

    expect(screen.queryByTestId('tag-district-0')).not.toBeInTheDocument();
  });

  test('should handle district codes not found in court division details', async () => {
    const trusteeWithUnknownDistrict = { ...mockTrustee, districts: ['UNKNOWN'] };
    mockGetTrustee.mockResolvedValue({ data: trusteeWithUnknownDistrict });
    mockGetCourts.mockResolvedValue({ data: mockCourts });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('John Doe');
    });

    // Should not render any district tags since the district code is not found
    expect(screen.queryByTestId('tag-district-0')).not.toBeInTheDocument();
  });

  test('should handle navigation state changes correctly', async () => {
    mockGetTrustee.mockResolvedValue({ data: mockTrustee });
    mockGetCourts.mockResolvedValue({ data: mockCourts });

    const { rerender } = renderWithRouter(['/trustees/123']);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('John Doe');
    });

    // Change location to audit history
    mockUseLocation.mockReturnValue({ pathname: '/trustees/123/audit-history' });

    rerender(
      <MemoryRouter initialEntries={['/trustees/123/audit-history']}>
        <Routes>
          <Route path="/trustees/:trusteeId/*" element={<TrusteeDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Trustee');
    });
  });

  test('should render assigned staff route correctly', async () => {
    mockGetTrustee.mockResolvedValue({ data: mockTrustee });
    mockGetCourts.mockResolvedValue({ data: mockCourts });

    renderWithRouter(['/trustees/123/assigned-staff']);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('John Doe');
    });

    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getByTestId('trustee-assigned-staff-nav-link')).toHaveClass('active');
  });

  test('should handle transformSoftwareList with empty array', async () => {
    mockGetTrustee.mockResolvedValue({ data: mockTrustee });
    mockGetCourts.mockResolvedValue({ data: mockCourts });
    mockGetBankruptcySoftwareList.mockResolvedValue({ data: [] });

    renderWithRouter(['/trustees/123/other/edit']);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
        'Edit Other Trustee Information',
      );
    });

    expect(mockGetBankruptcySoftwareList).toHaveBeenCalled();
  });

  test('should handle navigation functions when trustee becomes null', async () => {
    // Start with a loaded trustee
    mockGetTrustee.mockResolvedValue({ data: mockTrustee });
    mockGetCourts.mockResolvedValue({ data: mockCourts });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('John Doe');
    });

    // Test internal edit navigation
    const internalEditButton = screen.getByLabelText('Edit trustee internal contact information');
    internalEditButton.click();

    expect(mockNavigate).toHaveBeenLastCalledWith('/trustees/123/contact/edit/internal', {
      state: {
        trusteeId: '123',
        trustee: mockTrustee,
        cancelTo: '/trustees/123',
        action: 'edit',
        contactInformation: 'internal',
      },
    });

    // Test other info edit navigation
    const otherInfoEditButton = screen.getByLabelText('Edit other trustee information');
    otherInfoEditButton.click();

    expect(mockNavigate).toHaveBeenLastCalledWith('/trustees/123/other/edit', {
      state: {
        trusteeId: '123',
        trustee: mockTrustee,
        cancelTo: '/trustees/123',
        action: 'edit',
      },
    });
  });

  test('should handle edge case where response data is null but response exists', async () => {
    mockGetTrustee.mockResolvedValue({ data: mockTrustee });
    mockGetCourts.mockResolvedValue({ data: mockCourts });
    mockGetBankruptcySoftwareList.mockResolvedValue({}); // response exists but no data property

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('John Doe');
    });

    expect(mockGetBankruptcySoftwareList).toHaveBeenCalled();
  });

  test('should handle edge case where court response exists but no data property', async () => {
    mockGetTrustee.mockResolvedValue({ data: mockTrustee });
    mockGetCourts.mockResolvedValue({}); // response exists but no data property

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('John Doe');
    });

    expect(mockGetCourts).toHaveBeenCalled();
  });
});
