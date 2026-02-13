import { render, screen, waitFor } from '@testing-library/react';
import { vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import TrusteeDetailScreen from './TrusteeDetailScreen';
import { Trustee } from '@common/cams/trustees';
import { ContactInformation } from '@common/cams/contact';
import MockData from '@common/cams/test-utilities/mock-data';
import TestingUtilities from '@/lib/testing/testing-utilities';
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

describe('TrusteeDetailScreen', () => {
  const mockNavigate = vi.fn();

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
    TestingUtilities.spyOnGlobalAlert();

    mockUseParams.mockReturnValue({ trusteeId: '123' });
    mockUseNavigate.mockReturnValue(mockNavigate);

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
    });

    expect(screen.getByRole('navigation')).toBeInTheDocument();
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

    const globalAlertSpy = TestingUtilities.spyOnGlobalAlert();
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
    TestingUtilities.waitForDocumentBody();

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

  test('should navigate correctly when edit buttons are clicked', async () => {
    vi.spyOn(Api2, 'getTrustee').mockResolvedValue({ data: mockTrustee });
    vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: mockCourts });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('John Doe');
    });

    const publicEditButton = screen.getByTestId('button-edit-public-profile');
    publicEditButton.click();
    expect(mockNavigate).toHaveBeenCalledWith('/trustees/123/contact/edit/public');

    const internalEditButton = screen.getByTestId('button-edit-internal-profile');
    internalEditButton.click();
    expect(mockNavigate).toHaveBeenCalledWith('/trustees/123/contact/edit/internal');

    const otherInfoEditButton = screen.getByTestId('button-edit-other-information');
    otherInfoEditButton.click();
    expect(mockNavigate).toHaveBeenCalledWith('/trustees/123/other/edit');
  });

  test('should navigate to zoom edit route when edit zoom info button is clicked', async () => {
    const mockTrusteeWithZoom = {
      ...mockTrustee,
      zoomInfo: {
        link: 'https://us02web.zoom.us/j/1234567890',
        phone: '123-456-7890',
        meetingId: '1234567890',
        passcode: MockData.randomAlphaNumeric(10),
      },
    };

    vi.spyOn(Api2, 'getTrustee').mockResolvedValue({ data: mockTrusteeWithZoom });
    vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: mockCourts });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByTestId('trustee-detail-screen')).toBeInTheDocument();
    });

    const zoomEditButton = screen.getByTestId('button-edit-zoom-info');
    zoomEditButton.click();
    expect(mockNavigate).toHaveBeenCalledWith('/trustees/123/zoom/edit');
  });

  test('should pass onEditZoomInfo handler to TrusteeDetailProfile', async () => {
    vi.spyOn(Api2, 'getTrustee').mockResolvedValue({ data: mockTrustee });
    vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: mockCourts });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByTestId('trustee-detail-screen')).toBeInTheDocument();
    });

    expect(screen.getByTestId('button-edit-zoom-info')).toBeInTheDocument();
  });

  test('should display zoom info card when zoomInfo is provided', async () => {
    const testPasscode = MockData.randomAlphaNumeric(10);
    const mockTrusteeWithZoom = {
      ...mockTrustee,
      zoomInfo: {
        link: 'https://us02web.zoom.us/j/1234567890',
        phone: '123-456-7890',
        meetingId: '1234567890',
        passcode: testPasscode,
      },
    };

    vi.spyOn(Api2, 'getTrustee').mockResolvedValue({ data: mockTrusteeWithZoom });
    vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: mockCourts });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByTestId('trustee-detail-screen')).toBeInTheDocument();
    });

    expect(screen.getByTestId('zoom-info-heading')).toBeInTheDocument();
    expect(screen.getByTestId('zoom-info-content')).toBeInTheDocument();
    const zoomLinkContainer = screen.getByTestId('zoom-link');
    const zoomLink = zoomLinkContainer.querySelector('a');
    expect(zoomLink).toHaveAttribute('href', 'https://us02web.zoom.us/j/1234567890');
    const zoomPhoneContainer = screen.getByTestId('zoom-phone');
    expect(zoomPhoneContainer).toHaveTextContent('123-456-7890');
    expect(screen.getByTestId('zoom-meeting-id')).toHaveTextContent('Meeting ID: 123 456 7890');
    expect(screen.getByTestId('zoom-passcode')).toHaveTextContent(`Passcode: ${testPasscode}`);
  });

  test('should display "No information" message when zoomInfo is not provided', async () => {
    vi.spyOn(Api2, 'getTrustee').mockResolvedValue({ data: mockTrustee });
    vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: mockCourts });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByTestId('trustee-detail-screen')).toBeInTheDocument();
    });

    expect(screen.getByTestId('zoom-info-card')).toBeInTheDocument();
    expect(screen.getByTestId('zoom-info-heading')).toBeInTheDocument();
    expect(screen.getByTestId('zoom-info-empty-message')).toHaveTextContent(
      'No information added.',
    );
  });

  test.each([
    {
      route: '/trustees/123/appointments',
      expectedSubheader: 'Trustee',
      description: 'should render subheader "Trustee" for /appointments route',
      needsLocationState: false,
      needsAppointmentsMock: true,
    },
    {
      route: '/trustees/123/audit-history',
      expectedSubheader: 'Trustee',
      description: 'should render subheader "Trustee" for /audit-history route',
      needsLocationState: false,
      needsHistoryMock: true,
    },
    {
      route: '/trustees/123/zoom/edit',
      expectedSubheader: 'Edit 341 Meeting Information',
      description: 'should render subheader "Edit 341 Meeting Information" for /zoom/edit route',
      needsLocationState: false,
    },
    {
      route: '/trustees/123',
      expectedSubheader: 'Trustee',
      description: 'should render subheader "Trustee" for default route',
      needsLocationState: false,
    },
  ])(
    '$description',
    async ({ route, expectedSubheader, needsHistoryMock, needsAppointmentsMock }) => {
      vi.spyOn(Api2, 'getTrustee').mockResolvedValue({ data: mockTrustee });
      vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: mockCourts });

      if (needsHistoryMock) {
        vi.spyOn(Api2, 'getTrusteeHistory').mockResolvedValue({ data: [] });
      }

      if (needsAppointmentsMock) {
        vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({ data: [] });
      }

      renderWithRouter([route]);

      await waitFor(() => {
        expect(
          screen.getByRole('heading', { level: 2, name: expectedSubheader }),
        ).toBeInTheDocument();
      });
    },
  );

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

  test('should navigate to assistant create route when assistant button is clicked and no assistant exists', async () => {
    const trusteeWithoutAssistant = { ...mockTrustee, assistants: undefined };
    vi.spyOn(Api2, 'getTrustee').mockResolvedValue({ data: trusteeWithoutAssistant });
    vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: mockCourts });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('John Doe');
    });

    const assistantButton = screen.getByTestId('button-edit-assistant-empty');
    assistantButton.click();
    expect(mockNavigate).toHaveBeenCalledWith('/trustees/123/assistant/create');
  });

  test('should navigate to assistant create route when add another assistant button is clicked', async () => {
    const trusteeWithAssistant = {
      ...mockTrustee,
      assistants: [
        {
          id: 'assistant-1',
          trusteeId: '123',
          name: 'Jane Smith',
          contact: {
            email: 'jane.smith@example.com',
            phone: { number: '555-987-6543' },
            address: {
              address1: '456 Oak St',
              city: 'Springfield',
              state: 'IL',
              zipCode: '62701',
              countryCode: 'US' as const,
            },
          },
          updatedBy: { id: 'user-1', name: 'Admin User' },
          updatedOn: '2024-01-01T00:00:00Z',
        },
      ],
    };
    vi.spyOn(Api2, 'getTrustee').mockResolvedValue({ data: trusteeWithAssistant });
    vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: mockCourts });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('John Doe');
    });

    const addAnotherButton = screen.getByTestId('button-add-another-assistant-button');
    addAnotherButton.click();
    expect(mockNavigate).toHaveBeenCalledWith('/trustees/123/assistant/create');
  });
});
