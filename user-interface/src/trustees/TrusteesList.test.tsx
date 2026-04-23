import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import TrusteesList from './TrusteesList';
import Api2 from '@/lib/models/api2';
import { TrusteeListItem } from '@common/cams/trustees';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import { ResponseBody } from '@common/api/response';
import { vi } from 'vitest';
import MockData from '@common/cams/test-utilities/mock-data';
import LocalStorage from '@/lib/utils/local-storage';
import React from 'react';

function renderWithRouter(component: React.ReactElement) {
  return render(<BrowserRouter>{component}</BrowserRouter>);
}

function makeListItem(overrides: Partial<TrusteeListItem> = {}): TrusteeListItem {
  return {
    ...MockData.getTrustee(),
    appointments: [],
    ...overrides,
  };
}

function makeAppointment(overrides: Partial<TrusteeAppointment> = {}): TrusteeAppointment {
  return MockData.getTrusteeAppointment(overrides);
}

describe('TrusteesList Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  test('should display trustee count above table', async () => {
    const trustee1 = makeListItem({ trusteeId: 'trustee-1', name: 'Alice' });
    const trustee2 = makeListItem({ trusteeId: 'trustee-2', name: 'Bob' });
    const mockResponse: ResponseBody<TrusteeListItem[]> = { data: [trustee1, trustee2] };

    vi.spyOn(Api2, 'getTrustees').mockResolvedValue(mockResponse);

    renderWithRouter(<TrusteesList />);

    await waitFor(() => {
      expect(screen.getByText('2 Trustee(s)')).toBeInTheDocument();
    });
  });

  test('should display trustees list when data is loaded', async () => {
    const trustee1 = makeListItem({ trusteeId: 'trustee-1', name: 'John Doe' });
    const trustee2 = makeListItem({ trusteeId: 'trustee-2', name: 'Jane Smith' });
    const mockResponse: ResponseBody<TrusteeListItem[]> = { data: [trustee1, trustee2] };

    vi.spyOn(Api2, 'getTrustees').mockResolvedValue(mockResponse);

    renderWithRouter(<TrusteesList />);

    await waitFor(() => {
      expect(screen.getByTestId('trustees-table')).toBeInTheDocument();
    });

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  test('should display links to individual trustee profiles', async () => {
    const trustee1 = makeListItem({ trusteeId: 'trustee-1', name: 'John Doe' });
    const trustee2 = makeListItem({ trusteeId: 'trustee-2', name: 'Jane Smith' });
    const mockResponse: ResponseBody<TrusteeListItem[]> = { data: [trustee1, trustee2] };

    vi.spyOn(Api2, 'getTrustees').mockResolvedValue(mockResponse);

    renderWithRouter(<TrusteesList />);

    await waitFor(() => {
      expect(screen.getByTestId('trustee-link-trustee-1')).toBeInTheDocument();
    });

    expect(screen.getByTestId('trustee-link-trustee-1')).toHaveAttribute(
      'href',
      '/trustees/trustee-1',
    );
    expect(screen.getByTestId('trustee-link-trustee-2')).toHaveAttribute(
      'href',
      '/trustees/trustee-2',
    );
  });

  test('should render multiple rows for a trustee with multiple appointments', async () => {
    const trusteeId = 'trustee-multi';
    const appt1 = makeAppointment({
      trusteeId,
      chapter: '7',
      appointmentType: 'panel',
      status: 'active',
      courtId: 'court-1',
      courtName: 'Southern District of New York',
      courtDivisionName: 'Manhattan',
      divisionCode: '081',
    });
    const appt2 = makeAppointment({
      trusteeId,
      chapter: '11',
      appointmentType: 'case-by-case',
      status: 'inactive',
      courtId: 'court-2',
      courtName: 'District of Vermont',
      courtDivisionName: 'Burlington',
      divisionCode: '087',
    });
    const trustee = makeListItem({
      trusteeId,
      name: 'Multi Appt Trustee',
      appointments: [appt1, appt2],
    });
    const mockResponse: ResponseBody<TrusteeListItem[]> = { data: [trustee] };

    vi.spyOn(Api2, 'getTrustees').mockResolvedValue(mockResponse);

    renderWithRouter(<TrusteesList />);

    await waitFor(() => {
      expect(screen.getByTestId('trustees-table')).toBeInTheDocument();
    });

    expect(screen.getByText('Southern District of New York (Manhattan)')).toBeInTheDocument();
    expect(screen.getByText('District of Vermont (Burlington)')).toBeInTheDocument();
    expect(screen.getByText('Panel')).toBeInTheDocument();
    expect(screen.getByText('Case by Case')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  test('should format District (Division) correctly using courtName and courtDivisionName', async () => {
    const trusteeId = 'trustee-district';
    const appt = makeAppointment({
      trusteeId,
      courtName: 'Eastern District of California',
      courtDivisionName: 'Sacramento',
      divisionCode: '099',
    });
    const trustee = makeListItem({ trusteeId, name: 'District Trustee', appointments: [appt] });
    const mockResponse: ResponseBody<TrusteeListItem[]> = { data: [trustee] };

    vi.spyOn(Api2, 'getTrustees').mockResolvedValue(mockResponse);

    renderWithRouter(<TrusteesList />);

    await waitFor(() => {
      expect(screen.getByText('Eastern District of California (Sacramento)')).toBeInTheDocument();
    });
  });

  test('should fall back to courtId and divisionCode when court name fields are absent', async () => {
    const trusteeId = 'trustee-fallback';
    const appt = makeAppointment({
      trusteeId,
      courtId: 'court-xyz',
      divisionCode: '042',
      courtName: undefined,
      courtDivisionName: undefined,
    });
    const trustee = makeListItem({ trusteeId, name: 'Fallback Trustee', appointments: [appt] });
    const mockResponse: ResponseBody<TrusteeListItem[]> = { data: [trustee] };

    vi.spyOn(Api2, 'getTrustees').mockResolvedValue(mockResponse);

    renderWithRouter(<TrusteesList />);

    await waitFor(() => {
      expect(screen.getByText('court-xyz (042)')).toBeInTheDocument();
    });
  });

  test('should show one row with empty cells for a trustee with zero appointments', async () => {
    const trustee = makeListItem({
      trusteeId: 'trustee-zero',
      name: 'Zero Appt Trustee',
      appointments: [],
    });
    const mockResponse: ResponseBody<TrusteeListItem[]> = { data: [trustee] };

    vi.spyOn(Api2, 'getTrustees').mockResolvedValue(mockResponse);

    renderWithRouter(<TrusteesList />);

    await waitFor(() => {
      expect(screen.getByText('Zero Appt Trustee')).toBeInTheDocument();
    });

    expect(screen.getByTestId('trustees-table')).toBeInTheDocument();
    const rows = screen.getAllByRole('row');
    // header row + 1 data row
    expect(rows).toHaveLength(2);
  });

  test('should display empty state when no trustees exist', async () => {
    const mockResponse: ResponseBody<TrusteeListItem[]> = { data: [] };

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

  test('should handle API response with undefined data field', async () => {
    const mockResponse: ResponseBody<TrusteeListItem[]> = {
      data: undefined as unknown as TrusteeListItem[],
    };

    vi.spyOn(Api2, 'getTrustees').mockResolvedValue(mockResponse);

    renderWithRouter(<TrusteesList />);

    await waitFor(() => {
      expect(screen.getByText('No trustees found')).toBeInTheDocument();
    });

    expect(screen.getByText(/No trustee profiles have been created yet/)).toBeInTheDocument();
  });

  test('should display chapter, type, and status using format helpers', async () => {
    const trusteeId = 'trustee-format';
    const appt = makeAppointment({
      trusteeId,
      chapter: '11-subchapter-v',
      appointmentType: 'pool',
      status: 'voluntarily-suspended',
    });
    const trustee = makeListItem({ trusteeId, name: 'Format Trustee', appointments: [appt] });
    const mockResponse: ResponseBody<TrusteeListItem[]> = { data: [trustee] };

    vi.spyOn(Api2, 'getTrustees').mockResolvedValue(mockResponse);

    renderWithRouter(<TrusteesList />);

    await waitFor(() => {
      expect(screen.getByText('11 Subchapter V')).toBeInTheDocument();
    });

    expect(screen.getByText('Pool')).toBeInTheDocument();
    expect(screen.getByText('Voluntarily Suspended')).toBeInTheDocument();
  });

  describe('District Filtering', () => {
    test('should render district filter component with ARIA live region', async () => {
      const trustee = makeListItem({ trusteeId: 'trustee-1', name: 'Test Trustee' });
      const mockResponse: ResponseBody<TrusteeListItem[]> = { data: [trustee] };

      vi.spyOn(Api2, 'getTrustees').mockResolvedValue(mockResponse);
      vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: [] });

      renderWithRouter(<TrusteesList />);

      await waitFor(() => {
        expect(screen.getByText('Test Trustee')).toBeInTheDocument();
      });

      expect(screen.getByText('Filters')).toBeInTheDocument();
    });

    test('should include ARIA live region for filter announcements and display trustee count', async () => {
      const trustee1 = makeListItem({ trusteeId: 'trustee-1', name: 'Trustee One' });
      const trustee2 = makeListItem({ trusteeId: 'trustee-2', name: 'Trustee Two' });
      const mockResponse: ResponseBody<TrusteeListItem[]> = { data: [trustee1, trustee2] };

      vi.spyOn(Api2, 'getTrustees').mockResolvedValue(mockResponse);
      vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: [] });
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);

      renderWithRouter(<TrusteesList />);

      await waitFor(() => {
        expect(screen.getByText('2 Trustee(s)')).toBeInTheDocument();
      });

      const liveRegion = screen.getByRole('status');
      expect(liveRegion).toHaveAttribute('aria-live', 'polite');
      expect(liveRegion).toHaveAttribute('aria-atomic', 'true');
    });

    test('should filter trustees by selected district using OR logic', async () => {
      const apptNY = makeAppointment({ courtId: 'NYSB' });
      const apptVT = makeAppointment({ courtId: 'VTB' });
      const apptCA = makeAppointment({ courtId: 'CAB' });
      const trusteeNY = makeListItem({
        trusteeId: 'ny',
        name: 'New York Trustee',
        appointments: [apptNY],
      });
      const trusteeVT = makeListItem({
        trusteeId: 'vt',
        name: 'Vermont Trustee',
        appointments: [apptVT],
      });
      const trusteeCA = makeListItem({
        trusteeId: 'ca',
        name: 'California Trustee',
        appointments: [apptCA],
      });

      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({ data: [trusteeNY, trusteeVT, trusteeCA] });
      vi.spyOn(Api2, 'getCourts').mockResolvedValue({
        data: [
          {
            courtId: 'NYSB',
            courtName: 'Southern District of New York',
            officeCode: '081',
            officeName: 'Manhattan',
            courtDivisionCode: '081',
            courtDivisionName: 'Manhattan',
            groupDesignator: 'NY',
            regionId: '02',
            regionName: 'New York',
          },
          {
            courtId: 'VTB',
            courtName: 'District of Vermont',
            officeCode: '088',
            officeName: 'Rutland',
            courtDivisionCode: '088',
            courtDivisionName: 'Rutland',
            groupDesignator: 'VT',
            regionId: '01',
            regionName: 'Boston',
          },
          {
            courtId: 'CAB',
            courtName: 'Central District of California',
            officeCode: '099',
            officeName: 'Los Angeles',
            courtDivisionCode: '099',
            courtDivisionName: 'Los Angeles',
            groupDesignator: 'CA',
            regionId: '09',
            regionName: 'Los Angeles',
          },
        ],
      });
      // Session with NYSB + VTB offices — triggers filter callback with those two districts on mount
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue({
        ...MockData.getCamsSession(),
        user: {
          ...MockData.getCamsSession().user,
          offices: [
            {
              officeCode: '081',
              officeName: 'Manhattan',
              idpGroupName: 'Manhattan',
              regionId: '02',
              regionName: 'New York Region',
              groups: [
                {
                  groupDesignator: 'NY',
                  divisions: [
                    {
                      divisionCode: '081',
                      court: { courtId: 'NYSB', courtName: 'Southern District of New York' },
                      courtOffice: { courtOfficeCode: '081', courtOfficeName: 'Manhattan' },
                    },
                  ],
                },
              ],
            },
            {
              officeCode: '088',
              officeName: 'Rutland',
              idpGroupName: 'Rutland',
              regionId: '01',
              regionName: 'Boston Region',
              groups: [
                {
                  groupDesignator: 'VT',
                  divisions: [
                    {
                      divisionCode: '088',
                      court: { courtId: 'VTB', courtName: 'District of Vermont' },
                      courtOffice: { courtOfficeCode: '088', courtOfficeName: 'Rutland' },
                    },
                  ],
                },
              ],
            },
          ],
        },
      });

      renderWithRouter(<TrusteesList />);

      // NY and VT trustees appear, CA trustee is excluded
      await waitFor(() => {
        expect(screen.getByText('New York Trustee')).toBeInTheDocument();
        expect(screen.getByText('Vermont Trustee')).toBeInTheDocument();
        expect(screen.queryByText('California Trustee')).not.toBeInTheDocument();
      });
      expect(screen.getByText('2 Trustee(s)')).toBeInTheDocument();
    });

    test('should show all trustees when no district filter is active', async () => {
      const appt1 = makeAppointment({ courtId: 'NYSB' });
      const appt2 = makeAppointment({ courtId: 'VTB' });
      const trustee1 = makeListItem({
        trusteeId: 't1',
        name: 'Trustee Alpha',
        appointments: [appt1],
      });
      const trustee2 = makeListItem({
        trusteeId: 't2',
        name: 'Trustee Beta',
        appointments: [appt2],
      });
      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({ data: [trustee1, trustee2] });
      vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: [] });

      renderWithRouter(<TrusteesList />);

      await waitFor(() => {
        expect(screen.getByText('2 Trustee(s)')).toBeInTheDocument();
      });

      expect(screen.getByText('Trustee Alpha')).toBeInTheDocument();
      expect(screen.getByText('Trustee Beta')).toBeInTheDocument();
    });

    test('should show all trustees including unassigned ones when no district filter is active', async () => {
      const trusteeWithAppt = makeListItem({
        trusteeId: 't1',
        name: 'Appointed Trustee',
        appointments: [makeAppointment({ courtId: 'NYSB' })],
      });
      const trusteeNoAppt = makeListItem({
        trusteeId: 't2',
        name: 'Unassigned Trustee',
        appointments: [],
      });
      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({ data: [trusteeWithAppt, trusteeNoAppt] });
      vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: [] });
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);

      renderWithRouter(<TrusteesList />);

      await waitFor(() => {
        expect(screen.getByText('2 Trustee(s)')).toBeInTheDocument();
      });

      expect(screen.getByText('Appointed Trustee')).toBeInTheDocument();
      expect(screen.getByText('Unassigned Trustee')).toBeInTheDocument();
    });
  });
});
