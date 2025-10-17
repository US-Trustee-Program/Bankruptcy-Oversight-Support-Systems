import { render, screen, waitFor } from '@testing-library/react';
import { vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { UswdsTagStyle } from '@/lib/components/uswds/Tag';
import TrusteeDetailScreen from './TrusteeDetailScreen';
import { Trustee, TrusteeStatus } from '@common/cams/trustees';
import { ContactInformation } from '@common/cams/contact';

import MockData from '@common/cams/test-utilities/mock-data';
import testingUtilities from '@/lib/testing/testing-utilities';
import Api2 from '@/lib/models/api2';

const mockOnEditPublicProfile = vi.fn();
const mockOnEditInternalProfile = vi.fn();

const mockUseParams = vi.hoisted(() => vi.fn());
const mockUseNavigate = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: mockUseParams,
    useNavigate: mockUseNavigate,
  };
});

const mockTrustee: Trustee = MockData.getTrustee({
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
  districts: ['071', '091'],
  chapters: ['7-panel', '11', '13'],
  status: 'active',
});

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

const mockCourts = MockData.getCourts().filter(
  (c) => c.courtDivisionCode === '071' || c.courtDivisionCode === '091',
);

// We'll use spies on Api2 methods instead of creating our own mocks

describe('TrusteeDetailScreen', () => {
  const mockNavigate = vi.fn();

  const renderWithRouter = (initialEntries = ['/trustees/123'], trustee?: Trustee) => {
    return render(
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route
            path="/trustees/:trusteeId/*"
            element={<TrusteeDetailScreen trustee={trustee} />}
          />
        </Routes>
      </MemoryRouter>,
    );
  };

  beforeEach(() => {
    // Set up global alert spy
    testingUtilities.spyOnGlobalAlert();

    // Set up router mocks
    mockUseParams.mockReturnValue({ trusteeId: '123' });
    mockUseNavigate.mockReturnValue(mockNavigate);

    // Clear function mocks
    mockOnEditPublicProfile.mockClear();
    mockOnEditInternalProfile.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should display loading spinner while fetching data', async () => {
    vi.spyOn(Api2, 'getTrustee').mockImplementation(() => new Promise(() => {}));
    vi.spyOn(Api2, 'getCourts').mockImplementation(() => new Promise(() => {}));

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Trustee Details');
    });
  });

  test('should render trustee header when data is loaded', async () => {
    vi.spyOn(Api2, 'getTrustee').mockResolvedValue({
      data: { ...mockTrustee, internal: mockInternal },
    });
    vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: mockCourts });

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

  test('should render all trustee tags with proper formatting and content', async () => {
    vi.spyOn(Api2, 'getTrustee').mockResolvedValue({ data: mockTrustee });
    vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: mockCourts });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByTestId('tag-trustee-status')).toHaveTextContent('Active');

      expect(screen.getByTestId('tag-district-0')).toHaveTextContent(
        'Eastern District of New York (Brooklyn)',
      );
      expect(screen.getByTestId('tag-district-1')).toHaveTextContent(
        'Western District of New York (Buffalo)',
      );

      expect(screen.getByTestId('tag-chapter-0')).toHaveTextContent('Chapter 7 - Panel');
      expect(screen.getByTestId('tag-chapter-1')).toHaveTextContent('Chapter 11');
      expect(screen.getByTestId('tag-chapter-2')).toHaveTextContent('Chapter 13');
    });
  });

  test('should format "not active" status correctly', async () => {
    const inactiveTrustee = { ...mockTrustee, status: 'not active' as TrusteeStatus };
    vi.spyOn(Api2, 'getTrustee').mockResolvedValue({ data: inactiveTrustee });
    vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: mockCourts });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByTestId('tag-trustee-status')).toHaveTextContent('Not Active');
    });
  });

  test('should handle trustees with missing contact information', async () => {
    const trusteeWithoutEmailAndAddress = MockData.getTrustee({
      name: mockTrustee.name,
      trusteeId: mockTrustee.trusteeId,
      public: {
        phone: mockTrustee.public.phone,
        address: {
          address1: '',
          city: '',
          state: '',
          zipCode: '',
          countryCode: 'US',
        },
        // omit email intentionally
      },
    });
    vi.spyOn(Api2, 'getTrustee').mockResolvedValue({
      data: trusteeWithoutEmailAndAddress,
    });
    vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: mockCourts });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'John Doe' })).toBeInTheDocument();
    });

    expect(screen.queryByTestId('trustee-email')).not.toBeInTheDocument();
    expect(screen.queryByTestId('trustee-street-address')).not.toBeInTheDocument();
  });

  test('should handle API errors gracefully', async () => {
    const originalConsoleError = console.error;
    console.error = vi.fn();

    const globalAlertSpy = testingUtilities.spyOnGlobalAlert();
    vi.spyOn(Api2, 'getTrustee').mockRejectedValue(new Error('API Error'));
    vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: mockCourts });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByTestId('trustee-detail-screen')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Trustee Details');
    });

    await waitFor(() => {
      expect(globalAlertSpy.error).toHaveBeenCalledWith('Could not get trustee details');
    });

    expect(screen.getByTestId('404-NotFound')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: 'John Doe' })).not.toBeInTheDocument();

    console.error = originalConsoleError;
  });

  test('should render NotFound when no trusteeId is provided', () => {
    mockUseParams.mockReturnValue({});

    renderWithRouter();

    expect(screen.getByTestId('404-NotFound')).toBeInTheDocument();
  });

  test('should render NotFound when trustee is not found and not loading', async () => {
    mockUseParams.mockReturnValue({ trusteeId: '123' });
    const getTrusteeSpy = vi
      .spyOn(Api2, 'getTrustee')
      .mockRejectedValue(new Error('Trustee not found'));
    vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: mockCourts });

    renderWithRouter();

    await waitFor(() => {
      expect(getTrusteeSpy).toHaveBeenCalledWith('123');
    });

    expect(screen.getByTestId('404-NotFound')).toBeInTheDocument();
  });

  test.each([
    ['active', UswdsTagStyle.Green],
    ['suspended', UswdsTagStyle.SecondaryDark],
    ['', UswdsTagStyle.BaseDarkest],
  ])(
    'should format trustee status color for status "%s" with style "%s"',
    async (status, expectedStyle) => {
      const testTrustee = { ...mockTrustee, status: status as TrusteeStatus };
      vi.spyOn(Api2, 'getTrustee').mockResolvedValue({ data: testTrustee });
      vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: mockCourts });

      renderWithRouter();

      await waitFor(() => {
        const statusTag = screen.getByTestId('tag-trustee-status');
        expect(statusTag).toHaveClass(expectedStyle);
      });
    },
  );

  test('should navigate correctly when edit buttons are clicked', async () => {
    vi.spyOn(Api2, 'getTrustee').mockResolvedValue({ data: mockTrustee });
    vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: mockCourts });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('John Doe');
    });

    // Test public edit button
    const publicEditButton = screen.getByTestId('button-edit-public-profile');
    publicEditButton.click();
    expect(mockNavigate).toHaveBeenCalledWith('/trustees/123/contact/edit/public');

    // Test internal edit button
    const internalEditButton = screen.getByTestId('button-edit-internal-profile');
    internalEditButton.click();
    expect(mockNavigate).toHaveBeenCalledWith('/trustees/123/contact/edit/internal');

    // Test other info edit button
    const otherInfoEditButton = screen.getByTestId('button-edit-other-information');
    otherInfoEditButton.click();
    expect(mockNavigate).toHaveBeenCalledWith('/trustees/123/other/edit');
  });

  test('should use prop trustee when present and avoid unnecessary API calls', async () => {
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
    vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: mockCourts });
    renderWithRouter(['/trustees/123'], updatedTrustee);
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('John Doe Updated');
    });
    expect(screen.getByTestId('trustee-street-address')).toHaveTextContent('456 Updated Street');
    expect(screen.getByTestId('trustee-city')).toHaveTextContent('New City');
    expect(screen.getByTestId('trustee-email')).toHaveTextContent('john.updated@example.com');
    expect(screen.getByTestId('trustee-phone-number')).toHaveTextContent('555-999-8888, ext. 9999');

    expect(screen.queryByDisplayValue('123 Main St')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('john.doe.public@example.com')).not.toBeInTheDocument();
  });

  test.each([
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
  ])('$description', async ({ route, expectedSubheader, needsHistoryMock }) => {
    vi.spyOn(Api2, 'getTrustee').mockResolvedValue({ data: mockTrustee });
    vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: mockCourts });

    if (needsHistoryMock) {
      vi.spyOn(Api2, 'getTrusteeHistory').mockResolvedValue({ data: [] });
    }

    renderWithRouter([route]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(expectedSubheader);
    });
  });

  test('should fetch software options from API on component mount', async () => {
    vi.spyOn(Api2, 'getTrustee').mockResolvedValue({ data: mockTrustee });
    vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: mockCourts });
    const getBankruptcySoftwareListSpy = vi.spyOn(Api2, 'getBankruptcySoftwareList');

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('John Doe');
    });

    expect(getBankruptcySoftwareListSpy).toHaveBeenCalled();
  });

  test('should handle software options API error and log error message', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    vi.spyOn(Api2, 'getTrustee').mockResolvedValue({ data: mockTrustee });
    vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: mockCourts });
    const getBankruptcySoftwareListSpy = vi
      .spyOn(Api2, 'getBankruptcySoftwareList')
      .mockRejectedValue(new Error('Software API error'));

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('John Doe');
    });

    expect(getBankruptcySoftwareListSpy).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to fetch software options',
      'Software API error',
    );

    consoleSpy.mockRestore();
  });

  test('should handle software options API returning response without data property', async () => {
    vi.spyOn(Api2, 'getTrustee').mockResolvedValue({ data: mockTrustee });
    vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: mockCourts });
    const getBankruptcySoftwareListSpy = vi
      .spyOn(Api2, 'getBankruptcySoftwareList')
      .mockResolvedValue({ data: [] });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('John Doe');
    });

    expect(getBankruptcySoftwareListSpy).toHaveBeenCalled();
  });

  test('should handle court divisions API error and log error message', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    vi.spyOn(Api2, 'getTrustee').mockResolvedValue({ data: mockTrustee });
    const getCourts = vi.spyOn(Api2, 'getCourts').mockRejectedValue(new Error('Courts API error'));

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('John Doe');
    });

    expect(getCourts).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch court divisions', 'Courts API error');

    consoleSpy.mockRestore();
  });

  test('should transform software list correctly', async () => {
    const mockSoftwareData = [
      { _id: '1', list: 'bankruptcy-software', key: 'Alpha', value: 'Alpha Software' },
      { _id: '2', list: 'bankruptcy-software', key: 'Beta', value: 'Beta Platform' },
      { _id: '3', list: 'bankruptcy-software', key: 'Gamma', value: 'Gamma System' },
    ];

    vi.spyOn(Api2, 'getTrustee').mockResolvedValue({ data: mockTrustee });
    vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: mockCourts });
    const getBankruptcySoftwareListSpy = vi
      .spyOn(Api2, 'getBankruptcySoftwareList')
      .mockResolvedValue({ data: mockSoftwareData });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('John Doe');
    });

    expect(getBankruptcySoftwareListSpy).toHaveBeenCalled();
  });
});
