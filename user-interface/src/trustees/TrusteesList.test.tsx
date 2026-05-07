import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
import * as FeatureFlagHook from '@/lib/hooks/UseFeatureFlags';
import { FeatureFlagSet } from '@common/feature-flags';

const mockTrackEvent = vi.fn();
vi.mock('@/lib/hooks/UseApplicationInsights', () => ({
  getAppInsights: () => ({
    appInsights: { trackEvent: mockTrackEvent },
  }),
}));

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
    mockTrackEvent.mockReset();
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
      expect(screen.getByText('2 Trustee(s)', { selector: 'p' })).toBeInTheDocument();
    });
  });

  test('should display trustees list when data is loaded', async () => {
    const trustee1 = makeListItem({
      trusteeId: 'trustee-1',
      firstName: 'John',
      lastName: 'Doe',
      name: 'John Doe',
    });
    const trustee2 = makeListItem({
      trusteeId: 'trustee-2',
      firstName: 'Jane',
      lastName: 'Smith',
      name: 'Jane Smith',
    });
    const mockResponse: ResponseBody<TrusteeListItem[]> = { data: [trustee1, trustee2] };

    vi.spyOn(Api2, 'getTrustees').mockResolvedValue(mockResponse);

    renderWithRouter(<TrusteesList />);

    await waitFor(() => {
      expect(screen.getByTestId('trustees-table')).toBeInTheDocument();
    });

    expect(screen.getByText('Doe, John')).toBeInTheDocument();
    expect(screen.getByText('Smith, Jane')).toBeInTheDocument();
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

    expect(screen.getByText('Southern District of New York')).toBeInTheDocument();
    expect(screen.getByText('District of Vermont')).toBeInTheDocument();
    expect(screen.getByText('Panel')).toBeInTheDocument();
    expect(screen.getByText('Case by Case')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  test('should format District correctly using courtName only', async () => {
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
      expect(screen.getByText('Eastern District of California')).toBeInTheDocument();
    });
  });

  test('should fall back to courtId when courtName is absent', async () => {
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
      expect(screen.getByText('court-xyz')).toBeInTheDocument();
    });
  });

  test('should show one row with empty cells for a trustee with zero appointments', async () => {
    const trustee = makeListItem({
      trusteeId: 'trustee-zero',
      firstName: 'Zero',
      lastName: 'Appt',
      name: 'Zero Appt Trustee',
      appointments: [],
    });
    const mockResponse: ResponseBody<TrusteeListItem[]> = { data: [trustee] };

    vi.spyOn(Api2, 'getTrustees').mockResolvedValue(mockResponse);

    renderWithRouter(<TrusteesList />);

    await waitFor(() => {
      expect(screen.getByText('Appt, Zero')).toBeInTheDocument();
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
      const chapterCell = document.querySelector('[data-cell="Chapter"]') as HTMLElement;
      expect(within(chapterCell).getByText('11 Subchapter V')).toBeInTheDocument();
    });

    expect(screen.getByText('Pool')).toBeInTheDocument();
    expect(screen.getByText('Voluntarily Suspended')).toBeInTheDocument();
  });

  describe('Name Column Sort', () => {
    function makeTrusteeWithName(
      trusteeId: string,
      firstName: string,
      lastName: string,
    ): TrusteeListItem {
      return makeListItem({ trusteeId, firstName, lastName, name: `${firstName} ${lastName}` });
    }

    test('should show ascending sort indicator on Name header by default', async () => {
      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({
        data: [makeTrusteeWithName('t1', 'Alice', 'Smith')],
      });

      const { container } = renderWithRouter(<TrusteesList />);

      await waitFor(() => {
        expect(screen.getByTestId('trustees-table')).toBeInTheDocument();
      });

      const nameHeader = container.querySelector('[role="columnheader"][aria-sort="ascending"]');
      expect(nameHeader).toBeInTheDocument();
      expect(nameHeader).toHaveTextContent('Name');
    });

    test('should sort descending by last name when Name header is clicked', async () => {
      const user = userEvent.setup();
      const adams = makeTrusteeWithName('t1', 'Alice', 'Adams');
      const smith = makeTrusteeWithName('t2', 'Bob', 'Smith');
      const jones = makeTrusteeWithName('t3', 'Carol', 'Jones');
      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({ data: [adams, smith, jones] });

      renderWithRouter(<TrusteesList />);

      await waitFor(() => {
        expect(screen.getByTestId('trustees-table')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('columnheader', { name: /name/i }));

      const links = screen.getAllByRole('link');
      const names = links.map((l) => l.textContent);
      expect(names[0]).toBe('Smith, Bob');
      expect(names[1]).toBe('Jones, Carol');
      expect(names[2]).toBe('Adams, Alice');
    });

    test('should toggle back to ascending when Name header is clicked again', async () => {
      const user = userEvent.setup();
      const adams = makeTrusteeWithName('t1', 'Alice', 'Adams');
      const smith = makeTrusteeWithName('t2', 'Bob', 'Smith');
      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({ data: [adams, smith] });

      renderWithRouter(<TrusteesList />);

      await waitFor(() => {
        expect(screen.getByTestId('trustees-table')).toBeInTheDocument();
      });

      const nameHeader = screen.getByRole('columnheader', { name: /name/i });
      await user.click(nameHeader);
      await user.click(nameHeader);

      const links = screen.getAllByRole('link');
      expect(links[0]).toHaveTextContent('Adams, Alice');
      expect(links[1]).toHaveTextContent('Smith, Bob');
    });

    test('should update aria-sort attribute when sort direction changes', async () => {
      const user = userEvent.setup();
      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({
        data: [makeTrusteeWithName('t1', 'Alice', 'Smith')],
      });

      const { container } = renderWithRouter(<TrusteesList />);

      await waitFor(() => {
        expect(screen.getByTestId('trustees-table')).toBeInTheDocument();
      });

      const nameHeader = screen.getByRole('columnheader', { name: /name/i });
      await user.click(nameHeader);

      const descHeader = container.querySelector('[role="columnheader"][aria-sort="descending"]');
      expect(descHeader).toBeInTheDocument();
      expect(descHeader).toHaveTextContent('Name');
    });
  });

  describe('Success Metrics Telemetry', () => {
    test('should track Trustee List Loaded event with trusteeCount after data loads', async () => {
      const trustee1 = makeListItem({ trusteeId: 'trustee-1', name: 'Alice' });
      const trustee2 = makeListItem({ trusteeId: 'trustee-2', name: 'Bob' });
      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({ data: [trustee1, trustee2] });
      vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: [] });
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);

      renderWithRouter(<TrusteesList />);

      await waitFor(() => {
        expect(mockTrackEvent).toHaveBeenCalledWith(
          { name: 'Trustee List Loaded' },
          expect.objectContaining({
            trusteeCount: 2,
            loadMs: expect.any(Number),
          }),
        );
      });
    });

    test('should track Trustee District Filter Changed with isDefault=true when default filter applied', async () => {
      const apptNY = makeAppointment({ courtId: 'NYSB', divisionCode: '081' });
      const trusteeNY = makeListItem({
        trusteeId: 'ny',
        name: 'NY Trustee',
        appointments: [apptNY],
      });
      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({ data: [trusteeNY] });
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
            regionName: 'New York Region',
          },
        ],
      });
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
          ],
        },
      });

      renderWithRouter(<TrusteesList />);

      await waitFor(() => {
        expect(mockTrackEvent).toHaveBeenCalledWith(
          { name: 'Trustee District Filter Changed' },
          expect.objectContaining({ isDefault: true, selectedCount: 1, resultCount: 1 }),
        );
      });
    });
  });

  describe('Chapter Filtering', () => {
    test('should filter trustees by selected chapter', async () => {
      const ch7Appt = makeAppointment({ chapter: '7', divisionCode: '081' });
      const ch13Appt = makeAppointment({ chapter: '13', divisionCode: '088' });
      const trustee7 = makeListItem({
        trusteeId: 't7',
        firstName: 'Alice',
        lastName: 'Seven',
        appointments: [ch7Appt],
      });
      const trustee13 = makeListItem({
        trusteeId: 't13',
        firstName: 'Bob',
        lastName: 'Thirteen',
        appointments: [ch13Appt],
      });

      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({ data: [trustee7, trustee13] });
      vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: [] });
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);

      renderWithRouter(<TrusteesList />);

      expect(await screen.findByText('2 Trustee(s)', { selector: 'p' })).toBeInTheDocument();

      const toggleButton = screen.getByRole('button', { name: /filters/i });
      await userEvent.setup().click(toggleButton);

      expect(await screen.findByLabelText('Chapter')).toBeInTheDocument();

      const chapterCombobox = screen.getByLabelText('Chapter');
      await userEvent.setup().click(chapterCombobox);

      expect(await screen.findByRole('option', { name: /option: 13/ })).toBeInTheDocument();
      await userEvent.setup().click(screen.getByRole('option', { name: /option: 13/ }));

      await waitFor(() => {
        expect(screen.getByText('1 Trustee(s)', { selector: 'p' })).toBeInTheDocument();
        expect(screen.getByText('Thirteen, Bob')).toBeInTheDocument();
        expect(screen.queryByText('Seven, Alice')).not.toBeInTheDocument();
      });
    });

    test('should show all trustees when no chapter is selected', async () => {
      const trustee7 = makeListItem({
        trusteeId: 't7',
        firstName: 'Alice',
        lastName: 'Seven',
        appointments: [makeAppointment({ chapter: '7' })],
      });
      const trustee13 = makeListItem({
        trusteeId: 't13',
        firstName: 'Bob',
        lastName: 'Thirteen',
        appointments: [makeAppointment({ chapter: '13' })],
      });

      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({ data: [trustee7, trustee13] });
      vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: [] });
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);

      renderWithRouter(<TrusteesList />);

      await waitFor(() => {
        expect(screen.getByText('2 Trustee(s)', { selector: 'p' })).toBeInTheDocument();
        expect(screen.getByText('Seven, Alice')).toBeInTheDocument();
        expect(screen.getByText('Thirteen, Bob')).toBeInTheDocument();
      });
    });

    test('should AND-filter when both district and chapter filters are active', async () => {
      const apptA = makeAppointment({ chapter: '7', courtId: 'NYSB', divisionCode: '081' });
      const apptB = makeAppointment({ chapter: '13', courtId: 'NYSB', divisionCode: '081' });
      const apptC = makeAppointment({ chapter: '7', courtId: 'VTB', divisionCode: '088' });
      const trusteeA = makeListItem({
        trusteeId: 'a',
        firstName: 'Alice',
        lastName: 'Alpha',
        appointments: [apptA],
      });
      const trusteeB = makeListItem({
        trusteeId: 'b',
        firstName: 'Bob',
        lastName: 'Beta',
        appointments: [apptB],
      });
      const trusteeC = makeListItem({
        trusteeId: 'c',
        firstName: 'Carol',
        lastName: 'Gamma',
        appointments: [apptC],
      });

      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({ data: [trusteeA, trusteeB, trusteeC] });
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
        ],
      });
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
              regionName: 'New York',
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
          ],
        },
      });

      renderWithRouter(<TrusteesList />);

      // Wait for default district filter (Manhattan) to be applied — shows A and B
      expect(await screen.findByText('2 Trustee(s)', { selector: 'p' })).toBeInTheDocument();

      // Now select chapter 7
      const toggleButton = screen.getByRole('button', { name: /filters/i });
      await userEvent.setup().click(toggleButton);
      expect(await screen.findByLabelText('Chapter')).toBeInTheDocument();
      const chapterCombobox = screen.getByLabelText('Chapter');
      await userEvent.setup().click(chapterCombobox);
      expect(await screen.findByRole('option', { name: /option: 7/ })).toBeInTheDocument();
      await userEvent.setup().click(screen.getByRole('option', { name: /option: 7/ }));

      // Only Trustee A (ch7 + Manhattan) should remain
      await waitFor(() => {
        expect(screen.getByText('1 Trustee(s)', { selector: 'p' })).toBeInTheDocument();
        expect(screen.getByText('Alpha, Alice')).toBeInTheDocument();
        expect(screen.queryByText('Beta, Bob')).not.toBeInTheDocument();
        expect(screen.queryByText('Gamma, Carol')).not.toBeInTheDocument();
      });
    });

    test('should use OR logic within chapter filter', async () => {
      const trustee7 = makeListItem({
        trusteeId: 't7',
        firstName: 'Alice',
        lastName: 'Seven',
        appointments: [makeAppointment({ chapter: '7' })],
      });
      const trustee11 = makeListItem({
        trusteeId: 't11',
        firstName: 'Bob',
        lastName: 'Eleven',
        appointments: [makeAppointment({ chapter: '11' })],
      });
      const trustee13 = makeListItem({
        trusteeId: 't13',
        firstName: 'Carol',
        lastName: 'Thirteen',
        appointments: [makeAppointment({ chapter: '13' })],
      });

      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({ data: [trustee7, trustee11, trustee13] });
      vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: [] });
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);

      renderWithRouter(<TrusteesList />);
      expect(await screen.findByText('3 Trustee(s)', { selector: 'p' })).toBeInTheDocument();

      const user = userEvent.setup();
      const toggleButton = screen.getByRole('button', { name: /filters/i });
      await user.click(toggleButton);
      expect(await screen.findByLabelText('Chapter')).toBeInTheDocument();

      const chapterCombobox = screen.getByLabelText('Chapter');
      await user.click(chapterCombobox);
      expect(await screen.findByRole('option', { name: /option: 7/ })).toBeInTheDocument();
      await user.click(screen.getByRole('option', { name: /option: 7/ }));
      expect(await screen.findByRole('option', { name: /option: 13/ })).toBeInTheDocument();
      await user.click(screen.getByRole('option', { name: /option: 13/ }));

      await waitFor(() => {
        expect(screen.getByText('2 Trustee(s)', { selector: 'p' })).toBeInTheDocument();
        expect(screen.getByText('Seven, Alice')).toBeInTheDocument();
        expect(screen.getByText('Thirteen, Carol')).toBeInTheDocument();
        expect(screen.queryByText('Eleven, Bob')).not.toBeInTheDocument();
      });
    });

    test('should announce updated count in live region when chapter filter changes', async () => {
      const trustee7 = makeListItem({
        trusteeId: 't7',
        firstName: 'Alice',
        lastName: 'Seven',
        appointments: [makeAppointment({ chapter: '7' })],
      });
      const trustee13 = makeListItem({
        trusteeId: 't13',
        firstName: 'Bob',
        lastName: 'Thirteen',
        appointments: [makeAppointment({ chapter: '13' })],
      });

      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({ data: [trustee7, trustee13] });
      vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: [] });
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);

      renderWithRouter(<TrusteesList />);
      expect(await screen.findByText('2 Trustee(s)', { selector: 'p' })).toBeInTheDocument();

      const liveRegion = screen.getByRole('status');
      // live region starts empty — only populated after chapter interaction
      expect(liveRegion).toHaveTextContent('');

      const user = userEvent.setup();
      const toggleButton = screen.getByRole('button', { name: /filters/i });
      await user.click(toggleButton);
      expect(await screen.findByLabelText('Chapter')).toBeInTheDocument();
      const chapterCombobox = screen.getByLabelText('Chapter');
      await user.click(chapterCombobox);
      expect(await screen.findByRole('option', { name: /option: 7/ })).toBeInTheDocument();
      await user.click(screen.getByRole('option', { name: /option: 7/ }));

      await waitFor(() => {
        expect(liveRegion).toHaveTextContent('1 Trustees');
      });
    });
  });

  describe('Chapter Filter Telemetry', () => {
    test('should track Trustee Chapter Filter Changed with selectedCount, resultCount, districtCount, and selectedChapterValues', async () => {
      const trustee7 = makeListItem({
        trusteeId: 't7',
        firstName: 'Alice',
        lastName: 'Seven',
        appointments: [makeAppointment({ chapter: '7' })],
      });

      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({ data: [trustee7] });
      vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: [] });
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);

      renderWithRouter(<TrusteesList />);
      expect(await screen.findByText('1 Trustee(s)', { selector: 'p' })).toBeInTheDocument();

      const user = userEvent.setup();
      const toggleButton = screen.getByRole('button', { name: /filters/i });
      await user.click(toggleButton);
      expect(await screen.findByLabelText('Chapter')).toBeInTheDocument();
      const chapterCombobox = screen.getByLabelText('Chapter');
      await user.click(chapterCombobox);
      expect(await screen.findByRole('option', { name: /option: 7/ })).toBeInTheDocument();
      await user.click(screen.getByRole('option', { name: /option: 7/ }));

      await waitFor(() => {
        expect(mockTrackEvent).toHaveBeenCalledWith(
          { name: 'Trustee Chapter Filter Changed' },
          expect.objectContaining({
            selectedCount: 1,
            resultCount: 1,
            districtCount: 0,
            selectedChapterValues: '7',
          }),
        );
      });
    });

    test('should include districtCount when district filter is also active', async () => {
      const appt = makeAppointment({ chapter: '7', divisionCode: '081' });
      const trustee = makeListItem({
        trusteeId: 't1',
        firstName: 'Alice',
        lastName: 'Seven',
        appointments: [appt],
      });

      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({ data: [trustee] });
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
        ],
      });
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
              regionName: 'New York',
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
          ],
        },
      });

      renderWithRouter(<TrusteesList />);
      expect(await screen.findByText('1 Trustee(s)', { selector: 'p' })).toBeInTheDocument();

      const user = userEvent.setup();
      const toggleButton = screen.getByRole('button', { name: /filters/i });
      await user.click(toggleButton);
      expect(await screen.findByLabelText('Chapter')).toBeInTheDocument();
      const chapterCombobox = screen.getByLabelText('Chapter');
      await user.click(chapterCombobox);
      expect(await screen.findByRole('option', { name: /option: 7/ })).toBeInTheDocument();
      await user.click(screen.getByRole('option', { name: /option: 7/ }));

      await waitFor(() => {
        expect(mockTrackEvent).toHaveBeenCalledWith(
          { name: 'Trustee Chapter Filter Changed' },
          expect.objectContaining({
            selectedCount: 1,
            districtCount: 1,
            selectedChapterValues: '7',
          }),
        );
      });
    });
  });

  describe('Name Filter', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: [] });
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    test('renders name filter input inside accordion when expanded', async () => {
      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({
        data: [makeListItem({ trusteeId: 't1', firstName: 'Alice', lastName: 'Smith' })],
      });

      renderWithRouter(<TrusteesList />);
      expect(await screen.findByText('1 Trustee(s)', { selector: 'p' })).toBeInTheDocument();

      await userEvent
        .setup({ delay: null })
        .click(screen.getByRole('button', { name: /filters/i }));

      expect(screen.getByRole('textbox', { name: /trustee name/i })).toBeInTheDocument();
    });

    test('does not call searchTrustees when fewer than 2 characters typed', async () => {
      const searchSpy = vi.spyOn(Api2, 'searchTrustees');
      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({
        data: [makeListItem({ trusteeId: 't1', firstName: 'Alice', lastName: 'Smith' })],
      });

      renderWithRouter(<TrusteesList />);
      expect(await screen.findByText('1 Trustee(s)', { selector: 'p' })).toBeInTheDocument();

      await userEvent
        .setup({ delay: null })
        .click(screen.getByRole('button', { name: /filters/i }));
      await userEvent
        .setup({ delay: null })
        .type(screen.getByRole('textbox', { name: /trustee name/i }), 'S');

      await vi.advanceTimersByTimeAsync(300);

      expect(searchSpy).not.toHaveBeenCalled();
      expect(screen.getByText('1 Trustee(s)', { selector: 'p' })).toBeInTheDocument();
    });

    test('filters trustees by name when 2+ characters typed', async () => {
      const trustee1 = makeListItem({ trusteeId: 't1', firstName: 'Alice', lastName: 'Smith' });
      const trustee2 = makeListItem({ trusteeId: 't2', firstName: 'Bob', lastName: 'Jones' });
      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({ data: [trustee1, trustee2] });
      vi.spyOn(Api2, 'searchTrustees').mockResolvedValue({
        data: [{ ...trustee1, appointments: [], matchType: 'exact' }],
      });

      renderWithRouter(<TrusteesList />);
      expect(await screen.findByText('2 Trustee(s)', { selector: 'p' })).toBeInTheDocument();

      await userEvent
        .setup({ delay: null })
        .click(screen.getByRole('button', { name: /filters/i }));
      await userEvent
        .setup({ delay: null })
        .type(screen.getByRole('textbox', { name: /trustee name/i }), 'Sm');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });

      await waitFor(() => {
        expect(screen.getByText('1 Trustee(s)', { selector: 'p' })).toBeInTheDocument();
        expect(screen.getByText('Smith, Alice')).toBeInTheDocument();
        expect(screen.queryByText('Jones, Bob')).not.toBeInTheDocument();
      });
    });

    test('shows zero results when name search returns no matches', async () => {
      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({
        data: [makeListItem({ trusteeId: 't1', firstName: 'Alice', lastName: 'Smith' })],
      });
      vi.spyOn(Api2, 'searchTrustees').mockResolvedValue({ data: [] });

      renderWithRouter(<TrusteesList />);
      expect(await screen.findByText('1 Trustee(s)', { selector: 'p' })).toBeInTheDocument();

      await userEvent
        .setup({ delay: null })
        .click(screen.getByRole('button', { name: /filters/i }));
      await userEvent
        .setup({ delay: null })
        .type(screen.getByRole('textbox', { name: /trustee name/i }), 'xyz');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });

      await waitFor(() => {
        expect(screen.getByText('0 Trustee(s)', { selector: 'p' })).toBeInTheDocument();
        expect(screen.queryByText('Smith, Alice')).not.toBeInTheDocument();
      });
    });

    test('clears name filter and restores full list', async () => {
      const trustee1 = makeListItem({ trusteeId: 't1', firstName: 'Alice', lastName: 'Smith' });
      const trustee2 = makeListItem({ trusteeId: 't2', firstName: 'Bob', lastName: 'Jones' });
      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({ data: [trustee1, trustee2] });
      vi.spyOn(Api2, 'searchTrustees').mockResolvedValue({
        data: [{ ...trustee1, appointments: [], matchType: 'exact' }],
      });

      renderWithRouter(<TrusteesList />);
      expect(await screen.findByText('2 Trustee(s)', { selector: 'p' })).toBeInTheDocument();

      const user = userEvent.setup({ delay: null });
      await user.click(screen.getByRole('button', { name: /filters/i }));
      await user.type(screen.getByRole('textbox', { name: /trustee name/i }), 'Sm');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });
      expect(await screen.findByText('1 Trustee(s)', { selector: 'p' })).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /^clear$/i }));

      await waitFor(() => {
        expect(screen.getByText('2 Trustee(s)', { selector: 'p' })).toBeInTheDocument();
        expect(screen.getByText('Smith, Alice')).toBeInTheDocument();
        expect(screen.getByText('Jones, Bob')).toBeInTheDocument();
      });
    });

    test('live region announces count after name filter interaction', async () => {
      const trustee1 = makeListItem({ trusteeId: 't1', firstName: 'Alice', lastName: 'Smith' });
      const trustee2 = makeListItem({ trusteeId: 't2', firstName: 'Bob', lastName: 'Jones' });
      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({ data: [trustee1, trustee2] });
      vi.spyOn(Api2, 'searchTrustees').mockResolvedValue({
        data: [{ ...trustee1, appointments: [], matchType: 'exact' }],
      });

      renderWithRouter(<TrusteesList />);
      expect(await screen.findByText('2 Trustee(s)', { selector: 'p' })).toBeInTheDocument();

      const liveRegion = screen.getByRole('status');
      expect(liveRegion).toHaveTextContent('');

      await userEvent
        .setup({ delay: null })
        .click(screen.getByRole('button', { name: /filters/i }));
      await userEvent
        .setup({ delay: null })
        .type(screen.getByRole('textbox', { name: /trustee name/i }), 'Sm');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });

      await waitFor(() => {
        expect(liveRegion).toHaveTextContent('1 Trustees');
      });
    });

    test('tracks Trustee Name Filter Changed AppInsights event', async () => {
      const trustee1 = makeListItem({ trusteeId: 't1', firstName: 'Alice', lastName: 'Smith' });
      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({ data: [trustee1] });
      vi.spyOn(Api2, 'searchTrustees').mockResolvedValue({
        data: [{ ...trustee1, appointments: [], matchType: 'exact' }],
      });

      renderWithRouter(<TrusteesList />);
      expect(await screen.findByText('1 Trustee(s)', { selector: 'p' })).toBeInTheDocument();

      await userEvent
        .setup({ delay: null })
        .click(screen.getByRole('button', { name: /filters/i }));
      await userEvent
        .setup({ delay: null })
        .type(screen.getByRole('textbox', { name: /trustee name/i }), 'Sm');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });

      await waitFor(() => {
        expect(mockTrackEvent).toHaveBeenCalledWith(
          { name: 'Trustee Name Filter Changed' },
          expect.objectContaining({
            queryLength: 2,
            districtCount: 0,
            chapterCount: 0,
            hasDistrictFilter: false,
            sessionSearchCount: 1,
          }),
        );
      });
    });

    test('tracks Trustee Name Filter Changed event only once per search', async () => {
      const trustee1 = makeListItem({ trusteeId: 't1', firstName: 'Alice', lastName: 'Smith' });
      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({ data: [trustee1] });
      vi.spyOn(Api2, 'searchTrustees').mockResolvedValue({
        data: [{ ...trustee1, appointments: [], matchType: 'exact' }],
      });

      renderWithRouter(<TrusteesList />);
      expect(await screen.findByText('1 Trustee(s)', { selector: 'p' })).toBeInTheDocument();

      await userEvent
        .setup({ delay: null })
        .click(screen.getByRole('button', { name: /filters/i }));
      await userEvent
        .setup({ delay: null })
        .type(screen.getByRole('textbox', { name: /trustee name/i }), 'Sm');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });

      await waitFor(() => {
        expect(screen.getByText('1 Trustee(s)', { selector: 'p' })).toBeInTheDocument();
      });

      const changedCalls = mockTrackEvent.mock.calls.filter(
        ([event]) => event.name === 'Trustee Name Filter Changed',
      );
      expect(changedCalls).toHaveLength(1);
    });

    test('tracks Trustee Name Filter Cleared AppInsights event', async () => {
      const trustee1 = makeListItem({ trusteeId: 't1', firstName: 'Alice', lastName: 'Smith' });
      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({ data: [trustee1] });
      vi.spyOn(Api2, 'searchTrustees').mockResolvedValue({
        data: [{ ...trustee1, appointments: [], matchType: 'exact' }],
      });

      renderWithRouter(<TrusteesList />);
      expect(await screen.findByText('1 Trustee(s)', { selector: 'p' })).toBeInTheDocument();

      const user = userEvent.setup({ delay: null });
      await user.click(screen.getByRole('button', { name: /filters/i }));
      await user.type(screen.getByRole('textbox', { name: /trustee name/i }), 'Sm');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });

      await user.click(screen.getByRole('button', { name: /^clear$/i }));

      await waitFor(() => {
        expect(mockTrackEvent).toHaveBeenCalledWith(
          { name: 'Trustee Name Filter Cleared' },
          expect.objectContaining({ queryLength: 2, sessionSearchCount: 1 }),
        );
      });
    });

    test('sessionSearchCount reflects completed API calls, not keystrokes', async () => {
      // Typing "Smith" (5 chars, each >= 2) should count as 1 search, not 4.
      // Each keystroke triggers the effect but only the debounced callback fires once.
      const trustee1 = makeListItem({ trusteeId: 't1', firstName: 'Alice', lastName: 'Smith' });
      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({ data: [trustee1] });
      vi.spyOn(Api2, 'searchTrustees').mockResolvedValue({
        data: [{ ...trustee1, appointments: [], matchType: 'exact' }],
      });

      renderWithRouter(<TrusteesList />);
      expect(await screen.findByText('1 Trustee(s)', { selector: 'p' })).toBeInTheDocument();

      const user = userEvent.setup({ delay: null });
      await user.click(screen.getByRole('button', { name: /filters/i }));
      await user.type(screen.getByRole('textbox', { name: /trustee name/i }), 'Smith');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });

      await waitFor(() => {
        expect(mockTrackEvent).toHaveBeenCalledWith(
          { name: 'Trustee Name Filter Changed' },
          expect.objectContaining({ sessionSearchCount: 1 }),
        );
      });

      const changedCalls = mockTrackEvent.mock.calls.filter(
        ([event]) => event.name === 'Trustee Name Filter Changed',
      );
      // sessionSearchCount in the single event should be 1, not 4
      expect(changedCalls[0][1].sessionSearchCount).toBe(1);
    });

    test('restores full list when name search API call fails', async () => {
      // When searchTrustees throws, nameSearchIds is set to empty Set while
      // nameSearch.length >= 2 stays true — filtering out every trustee.
      const trustee1 = makeListItem({ trusteeId: 't1', firstName: 'Alice', lastName: 'Smith' });
      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({ data: [trustee1] });
      vi.spyOn(Api2, 'searchTrustees').mockRejectedValue(new Error('Network error'));

      renderWithRouter(<TrusteesList />);
      expect(await screen.findByText('1 Trustee(s)', { selector: 'p' })).toBeInTheDocument();

      const user = userEvent.setup({ delay: null });
      await user.click(screen.getByRole('button', { name: /filters/i }));
      await user.type(screen.getByRole('textbox', { name: /trustee name/i }), 'Sm');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });

      // Should NOT silently show "0 Trustee(s)" — either full list restored or error surfaced
      await waitFor(() => {
        expect(screen.queryByText('0 Trustee(s)', { selector: 'p' })).not.toBeInTheDocument();
      });
    });

    test('searchResponseMs measures only API latency, not the debounce delay', async () => {
      // searchStart is currently captured before the debounce fires, inflating the metric by ~300ms.
      // After the fix, the measured duration should be close to the actual API response time, not 300ms+.
      const trustee1 = makeListItem({ trusteeId: 't1', firstName: 'Alice', lastName: 'Smith' });
      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({ data: [trustee1] });

      let resolveSearch!: () => void;
      vi.spyOn(Api2, 'searchTrustees').mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSearch = () =>
              resolve({ data: [{ ...trustee1, appointments: [], matchType: 'exact' }] });
          }),
      );

      renderWithRouter(<TrusteesList />);
      expect(await screen.findByText('1 Trustee(s)', { selector: 'p' })).toBeInTheDocument();

      const user = userEvent.setup({ delay: null });
      await user.click(screen.getByRole('button', { name: /filters/i }));
      await user.type(screen.getByRole('textbox', { name: /trustee name/i }), 'Sm');

      // Advance past debounce — API call is now in-flight
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });

      // Resolve the API call immediately (simulates near-zero API latency)
      await act(async () => {
        resolveSearch();
      });

      await waitFor(() => {
        const changedCalls = mockTrackEvent.mock.calls.filter(
          ([event]) => event.name === 'Trustee Name Filter Changed',
        );
        expect(changedCalls.length).toBeGreaterThan(0);
        const { searchResponseMs } = changedCalls[0][1];
        // If searchStart is captured outside the debounce, this will be ~300ms+.
        // After the fix it should be well under 300ms (near 0 since mock resolves instantly).
        expect(searchResponseMs).toBeDefined();
        expect(searchResponseMs).toBeLessThan(300);
      });
    });

    test('shows spinner in table body while name search request is in-flight', async () => {
      const trustee1 = makeListItem({ trusteeId: 't1', firstName: 'Alice', lastName: 'Smith' });
      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({ data: [trustee1] });
      vi.spyOn(Api2, 'searchTrustees').mockImplementation(() => new Promise(() => {}));

      renderWithRouter(<TrusteesList />);
      expect(await screen.findByText('1 Trustee(s)', { selector: 'p' })).toBeInTheDocument();

      const user = userEvent.setup({ delay: null });
      await user.click(screen.getByRole('button', { name: /filters/i }));
      await user.type(screen.getByRole('textbox', { name: /trustee name/i }), 'Sm');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });

      expect(screen.getByText('Searching trustees...')).toBeInTheDocument();
      expect(screen.queryByText('Smith, Alice')).not.toBeInTheDocument();
    });

    test('column headers remain visible while name search is loading', async () => {
      const trustee1 = makeListItem({ trusteeId: 't1', firstName: 'Alice', lastName: 'Smith' });
      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({ data: [trustee1] });
      vi.spyOn(Api2, 'searchTrustees').mockImplementation(() => new Promise(() => {}));

      renderWithRouter(<TrusteesList />);
      expect(await screen.findByText('1 Trustee(s)', { selector: 'p' })).toBeInTheDocument();

      const user = userEvent.setup({ delay: null });
      await user.click(screen.getByRole('button', { name: /filters/i }));
      await user.type(screen.getByRole('textbox', { name: /trustee name/i }), 'Sm');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });

      expect(screen.getByRole('columnheader', { name: /name/i })).toBeInTheDocument();
      expect(screen.getByText('District')).toBeInTheDocument();
      expect(screen.getByText('Searching trustees...')).toBeInTheDocument();
    });

    test('preserves previous result count while new name search is in-flight', async () => {
      const trustee1 = makeListItem({ trusteeId: 't1', firstName: 'Alice', lastName: 'Smith' });
      const trustee2 = makeListItem({ trusteeId: 't2', firstName: 'Bob', lastName: 'Jones' });
      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({ data: [trustee1, trustee2] });

      let resolveFirst!: () => void;
      vi.spyOn(Api2, 'searchTrustees')
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveFirst = () =>
                resolve({ data: [{ ...trustee1, appointments: [], matchType: 'exact' }] });
            }),
        )
        .mockImplementationOnce(() => new Promise(() => {}));

      renderWithRouter(<TrusteesList />);
      expect(await screen.findByText('2 Trustee(s)', { selector: 'p' })).toBeInTheDocument();

      const user = userEvent.setup({ delay: null });
      await user.click(screen.getByRole('button', { name: /filters/i }));
      await user.type(screen.getByRole('textbox', { name: /trustee name/i }), 'Sm');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });

      await act(async () => {
        resolveFirst();
      });

      await waitFor(() => {
        expect(screen.getByText('1 Trustee(s)', { selector: 'p' })).toBeInTheDocument();
      });

      // Type another character — triggers second (never-resolving) request
      await user.type(screen.getByRole('textbox', { name: /trustee name/i }), 'i');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });

      // Snapshot count (1) should be displayed, not the full list (2) or zero
      expect(screen.getByText('1 Trustee(s)', { selector: 'p' })).toBeInTheDocument();
      expect(screen.getByText('Searching trustees...')).toBeInTheDocument();
    });

    test('replaces spinner with correct results when name search completes', async () => {
      const trustee1 = makeListItem({ trusteeId: 't1', firstName: 'Alice', lastName: 'Smith' });
      const trustee2 = makeListItem({ trusteeId: 't2', firstName: 'Bob', lastName: 'Jones' });
      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({ data: [trustee1, trustee2] });

      let resolveSearch!: () => void;
      vi.spyOn(Api2, 'searchTrustees').mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSearch = () =>
              resolve({ data: [{ ...trustee1, appointments: [], matchType: 'exact' }] });
          }),
      );

      renderWithRouter(<TrusteesList />);
      expect(await screen.findByText('2 Trustee(s)', { selector: 'p' })).toBeInTheDocument();

      const user = userEvent.setup({ delay: null });
      await user.click(screen.getByRole('button', { name: /filters/i }));
      await user.type(screen.getByRole('textbox', { name: /trustee name/i }), 'Sm');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });

      expect(screen.getByText('Searching trustees...')).toBeInTheDocument();

      await act(async () => {
        resolveSearch();
      });

      await waitFor(() => {
        expect(screen.queryByText('Searching trustees...')).not.toBeInTheDocument();
        expect(screen.getByText('1 Trustee(s)', { selector: 'p' })).toBeInTheDocument();
        expect(screen.getByText('Smith, Alice')).toBeInTheDocument();
        expect(screen.queryByText('Jones, Bob')).not.toBeInTheDocument();
      });
    });

    test('clears spinner and restores full list when query drops below 2 chars while in-flight', async () => {
      const trustee1 = makeListItem({ trusteeId: 't1', firstName: 'Alice', lastName: 'Smith' });
      const trustee2 = makeListItem({ trusteeId: 't2', firstName: 'Bob', lastName: 'Jones' });
      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({ data: [trustee1, trustee2] });
      vi.spyOn(Api2, 'searchTrustees').mockImplementation(() => new Promise(() => {}));

      renderWithRouter(<TrusteesList />);
      expect(await screen.findByText('2 Trustee(s)', { selector: 'p' })).toBeInTheDocument();

      const user = userEvent.setup({ delay: null });
      await user.click(screen.getByRole('button', { name: /filters/i }));
      await user.type(screen.getByRole('textbox', { name: /trustee name/i }), 'Sm');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });

      expect(screen.getByText('Searching trustees...')).toBeInTheDocument();

      await user.clear(screen.getByRole('textbox', { name: /trustee name/i }));

      await waitFor(() => {
        expect(screen.queryByText('Searching trustees...')).not.toBeInTheDocument();
        expect(screen.getByText('2 Trustee(s)', { selector: 'p' })).toBeInTheDocument();
        expect(screen.getByText('Smith, Alice')).toBeInTheDocument();
        expect(screen.getByText('Jones, Bob')).toBeInTheDocument();
      });
    });
  });

  describe('District Filtering', () => {
    test('should render district filter component with ARIA live region', async () => {
      const trustee = makeListItem({
        trusteeId: 'trustee-1',
        firstName: 'Test',
        lastName: 'Trustee',
        name: 'Test Trustee',
      });
      const mockResponse: ResponseBody<TrusteeListItem[]> = { data: [trustee] };

      vi.spyOn(Api2, 'getTrustees').mockResolvedValue(mockResponse);
      vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: [] });

      renderWithRouter(<TrusteesList />);

      await waitFor(() => {
        expect(screen.getByText('Trustee, Test')).toBeInTheDocument();
      });

      expect(screen.getByText('Filters')).toBeInTheDocument();
    });

    test('should have proper ARIA attributes for accessibility', async () => {
      const trustee1 = makeListItem({ trusteeId: 'trustee-1', name: 'Trustee One' });
      const trustee2 = makeListItem({ trusteeId: 'trustee-2', name: 'Trustee Two' });
      const mockResponse: ResponseBody<TrusteeListItem[]> = { data: [trustee1, trustee2] };

      vi.spyOn(Api2, 'getTrustees').mockResolvedValue(mockResponse);
      vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: [] });
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);

      renderWithRouter(<TrusteesList />);

      await waitFor(() => {
        expect(screen.getByText('2 Trustee(s)', { selector: 'p' })).toBeInTheDocument();
      });

      // Check live region for filter announcements
      const liveRegion = screen.getByRole('status');
      expect(liveRegion).toBeInTheDocument();

      // Check filter section
      expect(screen.getByRole('region', { name: 'Trustee filter controls' })).toBeInTheDocument();

      // Check table
      const table = screen.getByTestId('trustees-table');
      expect(table).toHaveAttribute('role', 'table');
      expect(table).toHaveAttribute('aria-label', 'Trustees');
    });

    test('should filter trustees by selected district using OR logic', async () => {
      const apptNY = makeAppointment({ courtId: 'NYSB', divisionCode: '081' });
      const apptVT = makeAppointment({ courtId: 'VTB', divisionCode: '088' });
      const apptCA = makeAppointment({ courtId: 'CAB', divisionCode: '999' });
      const trusteeNY = makeListItem({
        trusteeId: 'ny',
        firstName: 'New York',
        lastName: 'Trustee',
        name: 'New York Trustee',
        appointments: [apptNY],
      });
      const trusteeVT = makeListItem({
        trusteeId: 'vt',
        firstName: 'Vermont',
        lastName: 'Trustee',
        name: 'Vermont Trustee',
        appointments: [apptVT],
      });
      const trusteeCA = makeListItem({
        trusteeId: 'ca',
        firstName: 'California',
        lastName: 'Trustee',
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
        expect(screen.getByText('Trustee, New York')).toBeInTheDocument();
        expect(screen.getByText('Trustee, Vermont')).toBeInTheDocument();
        expect(screen.queryByText('Trustee, California')).not.toBeInTheDocument();
      });
      expect(screen.getByText('2 Trustee(s)', { selector: 'p' })).toBeInTheDocument();
    });

    test('should show all trustees when no district filter is active, including unassigned ones', async () => {
      const trusteeWithAppt = makeListItem({
        trusteeId: 't1',
        firstName: 'Appointed',
        lastName: 'Trustee',
        name: 'Appointed Trustee',
        appointments: [makeAppointment({ courtId: 'NYSB', divisionCode: '081' })],
      });
      const trusteeNoAppt = makeListItem({
        trusteeId: 't2',
        firstName: 'Unassigned',
        lastName: 'Trustee',
        name: 'Unassigned Trustee',
        appointments: [],
      });
      const trusteeAnotherAppt = makeListItem({
        trusteeId: 't3',
        firstName: 'Vermont',
        lastName: 'Trustee',
        name: 'Vermont Trustee',
        appointments: [makeAppointment({ courtId: 'VTB' })],
      });
      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({
        data: [trusteeWithAppt, trusteeNoAppt, trusteeAnotherAppt],
      });
      vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: [] });
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);

      renderWithRouter(<TrusteesList />);

      await waitFor(() => {
        expect(screen.getByText('3 Trustee(s)', { selector: 'p' })).toBeInTheDocument();
      });

      expect(screen.getByText('Trustee, Appointed')).toBeInTheDocument();
      expect(screen.getByText('Trustee, Unassigned')).toBeInTheDocument();
      expect(screen.getByText('Trustee, Vermont')).toBeInTheDocument();
    });

    test('should render pills above trustee count when filter is expanded', async () => {
      vi.spyOn(FeatureFlagHook, 'default').mockReturnValue({
        'trustee-district-division': false,
      } as FeatureFlagSet);
      const user = userEvent.setup();
      const trusteeWithAppt = makeListItem({
        trusteeId: 't1',
        name: 'Trustee One',
        appointments: [
          makeAppointment({
            courtId: 'NYSB',
            divisionCode: '081',
            courtName: 'Southern District of New York',
          }),
        ],
      });
      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({ data: [trusteeWithAppt] });
      vi.spyOn(Api2, 'getCourts').mockResolvedValue({
        data: [
          {
            courtId: 'NYSB',
            courtName: 'Southern District of New York',
            officeName: 'Manhattan',
            officeCode: '081',
            courtDivisionCode: '081',
            courtDivisionName: 'Manhattan',
            groupDesignator: 'NY',
            regionId: '02',
            regionName: 'New York Region',
          },
        ],
      });
      const session = {
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
                      court: {
                        courtId: 'NYSB',
                        courtName: 'Southern District of New York',
                        courtDivisionCode: '081',
                        courtDivisionName: 'Manhattan',
                      },
                      courtOffice: {
                        courtOfficeCode: '081',
                        courtOfficeName: 'Manhattan',
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      };
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);

      renderWithRouter(<TrusteesList />);

      await waitFor(() => {
        expect(screen.getByText('Filters')).toBeInTheDocument();
      });

      // Initially collapsed - pills should be in filter component
      await waitFor(() => {
        const pills = screen.getAllByText('Southern District of New York');
        expect(pills.length).toBeGreaterThan(0);
      });

      // Expand filter
      const toggleButton = screen.getByRole('button', { name: /filters/i });
      await user.click(toggleButton);

      // When expanded, pills should appear above trustee count (in TrusteesList)
      await waitFor(() => {
        const pills = screen.getAllByText('Southern District of New York');
        // Should have pills both in dropdown AND in list area
        expect(pills.length).toBeGreaterThan(1);
      });
    });

    test('should delegate pill removal to filter ref when X clicked on expanded pills', async () => {
      vi.spyOn(FeatureFlagHook, 'default').mockReturnValue({
        'trustee-district-division': false,
      } as FeatureFlagSet);
      const user = userEvent.setup();
      const trusteeWithAppt = makeListItem({
        trusteeId: 't1',
        name: 'Trustee One',
        appointments: [
          makeAppointment({
            courtId: 'NYSB',
            divisionCode: '081',
            courtName: 'Southern District of New York',
          }),
        ],
      });
      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({ data: [trusteeWithAppt] });
      vi.spyOn(Api2, 'getCourts').mockResolvedValue({
        data: [
          {
            courtId: 'NYSB',
            courtName: 'Southern District of New York',
            officeName: 'Manhattan',
            officeCode: '081',
            courtDivisionCode: '081',
            courtDivisionName: 'Manhattan',
            groupDesignator: 'NY',
            regionId: '02',
            regionName: 'New York Region',
          },
        ],
      });
      const session = {
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
                      court: {
                        courtId: 'NYSB',
                        courtName: 'Southern District of New York',
                        courtDivisionCode: '081',
                        courtDivisionName: 'Manhattan',
                      },
                      courtOffice: {
                        courtOfficeCode: '081',
                        courtOfficeName: 'Manhattan',
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      };
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);

      renderWithRouter(<TrusteesList />);

      await waitFor(() => {
        expect(screen.getByText('Filters')).toBeInTheDocument();
      });

      // Expand filter
      const toggleButton = screen.getByRole('button', { name: /filters/i });
      await user.click(toggleButton);

      // Wait for pills to appear
      await waitFor(() => {
        const pills = screen.getAllByText('Southern District of New York');
        expect(pills.length).toBeGreaterThan(1);
      });

      // Click remove button on one of the pills (PillBox component)
      const pillButton = screen.getByRole('button', {
        name: /southern district of new york selected.*click to deselect/i,
      });
      await user.click(pillButton);

      // Should remove the filter and show all trustees
      await waitFor(() => {
        expect(screen.getByText('1 Trustee(s)', { selector: 'p' })).toBeInTheDocument();
      });
    });
  });

  describe('District Filter - courtId matching (flag ON)', () => {
    beforeEach(() => {
      vi.spyOn(FeatureFlagHook, 'default').mockReturnValue({
        'trustee-district-division': true,
      } as FeatureFlagSet);
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
            regionName: 'New York Region',
          },
        ],
      });
    });

    test('flag ON: trustee with divisionCodes only (no divisionCode) appears when courtId district is selected', async () => {
      const appt = makeAppointment({
        courtId: 'NYSB',
        divisionCode: undefined,
        divisionCodes: ['081'],
      });
      const trusteeNY = makeListItem({
        trusteeId: 'ny',
        firstName: 'New',
        lastName: 'York',
        appointments: [appt],
      });
      const trusteeOther = makeListItem({
        trusteeId: 'other',
        firstName: 'Other',
        lastName: 'Trustee',
        appointments: [makeAppointment({ courtId: 'VTB', divisionCodes: ['088'] })],
      });

      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({ data: [trusteeNY, trusteeOther] });
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
          ],
        },
      });

      renderWithRouter(<TrusteesList />);

      await waitFor(() => {
        expect(screen.getByText('York, New')).toBeInTheDocument();
        expect(screen.queryByText('Trustee, Other')).not.toBeInTheDocument();
      });
    });

    test('flag ON: trustee with empty divisionCodes (all divisions) appears when courtId district is selected', async () => {
      const appt = makeAppointment({
        courtId: 'NYSB',
        divisionCode: undefined,
        divisionCodes: [],
      });
      const trustee = makeListItem({
        trusteeId: 'ny',
        firstName: 'All',
        lastName: 'Divisions',
        appointments: [appt],
      });

      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({ data: [trustee] });
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
          ],
        },
      });

      renderWithRouter(<TrusteesList />);

      await waitFor(() => {
        expect(screen.getByText('Divisions, All')).toBeInTheDocument();
        expect(screen.getByText('1 Trustee(s)', { selector: 'p' })).toBeInTheDocument();
      });
    });

    test('flag ON: trustee in a different district does NOT appear', async () => {
      const apptNY = makeAppointment({ courtId: 'NYSB', divisionCodes: ['081'] });
      const apptCA = makeAppointment({ courtId: 'CAB', divisionCodes: ['099'] });
      const trusteeNY = makeListItem({
        trusteeId: 'ny',
        firstName: 'New',
        lastName: 'York',
        appointments: [apptNY],
      });
      const trusteeCA = makeListItem({
        trusteeId: 'ca',
        firstName: 'Cali',
        lastName: 'Fornia',
        appointments: [apptCA],
      });

      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({ data: [trusteeNY, trusteeCA] });
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
          ],
        },
      });

      renderWithRouter(<TrusteesList />);

      await waitFor(() => {
        expect(screen.getByText('York, New')).toBeInTheDocument();
        expect(screen.queryByText('Fornia, Cali')).not.toBeInTheDocument();
      });
    });

    test('flag ON: no district selected — all trustees appear', async () => {
      const trusteeNY = makeListItem({
        trusteeId: 'ny',
        firstName: 'New',
        lastName: 'York',
        appointments: [makeAppointment({ courtId: 'NYSB' })],
      });
      const trusteeCA = makeListItem({
        trusteeId: 'ca',
        firstName: 'Cali',
        lastName: 'Fornia',
        appointments: [makeAppointment({ courtId: 'CAB' })],
      });

      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({ data: [trusteeNY, trusteeCA] });
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);

      renderWithRouter(<TrusteesList />);

      await waitFor(() => {
        expect(screen.getByText('2 Trustee(s)', { selector: 'p' })).toBeInTheDocument();
        expect(screen.getByText('York, New')).toBeInTheDocument();
        expect(screen.getByText('Fornia, Cali')).toBeInTheDocument();
      });
    });

    test('flag OFF: filter still uses division code matching (existing behavior)', async () => {
      vi.spyOn(FeatureFlagHook, 'default').mockReturnValue({
        'trustee-district-division': false,
      } as FeatureFlagSet);

      const appt = makeAppointment({ courtId: 'NYSB', divisionCode: '081' });
      const trusteeNY = makeListItem({
        trusteeId: 'ny',
        firstName: 'New',
        lastName: 'York',
        appointments: [appt],
      });
      const trusteeOther = makeListItem({
        trusteeId: 'other',
        firstName: 'Other',
        lastName: 'Person',
        appointments: [makeAppointment({ courtId: 'VTB', divisionCode: '088' })],
      });

      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({ data: [trusteeNY, trusteeOther] });
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
          ],
        },
      });

      renderWithRouter(<TrusteesList />);

      await waitFor(() => {
        expect(screen.getByText('York, New')).toBeInTheDocument();
        expect(screen.queryByText('Person, Other')).not.toBeInTheDocument();
        expect(screen.getByText('1 Trustee(s)', { selector: 'p' })).toBeInTheDocument();
      });
    });
  });

  describe('Division Column (Feature Flag)', () => {
    beforeEach(() => {
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
            regionName: 'New York Region',
          },
          {
            courtId: 'NYSB',
            courtName: 'Southern District of New York',
            officeCode: '087',
            officeName: 'White Plains',
            courtDivisionCode: '087',
            courtDivisionName: 'White Plains',
            groupDesignator: 'NY',
            regionId: '02',
            regionName: 'New York Region',
          },
        ],
      });
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);
    });

    test('should display Division column header when feature flag is ON', async () => {
      vi.spyOn(FeatureFlagHook, 'default').mockReturnValue({
        'trustee-district-division': true,
      } as FeatureFlagSet);

      const trustee = makeListItem({
        trusteeId: 't1',
        firstName: 'Alice',
        lastName: 'Smith',
        appointments: [makeAppointment({ courtId: 'NYSB', divisionCode: '081' })],
      });
      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({ data: [trustee] });

      renderWithRouter(<TrusteesList />);

      await waitFor(() => {
        expect(screen.getByTestId('trustees-table')).toBeInTheDocument();
      });

      const headers = screen.getAllByRole('columnheader');
      const headerTexts = headers.map((h) => h.textContent);
      expect(headerTexts).toContain('Division');
    });

    test('should NOT display Division column header when feature flag is OFF', async () => {
      vi.spyOn(FeatureFlagHook, 'default').mockReturnValue({
        'trustee-district-division': false,
      } as FeatureFlagSet);

      const trustee = makeListItem({
        trusteeId: 't1',
        firstName: 'Alice',
        lastName: 'Smith',
        appointments: [makeAppointment({ courtId: 'NYSB', divisionCode: '081' })],
      });
      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({ data: [trustee] });

      renderWithRouter(<TrusteesList />);

      await waitFor(() => {
        expect(screen.getByTestId('trustees-table')).toBeInTheDocument();
      });

      const headers = screen.getAllByRole('columnheader');
      const headerTexts = headers.map((h) => h.textContent);
      expect(headerTexts).not.toContain('Division');
    });

    test('should display "All" when appointment covers all divisions in a district', async () => {
      vi.spyOn(FeatureFlagHook, 'default').mockReturnValue({
        'trustee-district-division': true,
      } as FeatureFlagSet);

      const trustee = makeListItem({
        trusteeId: 't1',
        firstName: 'Alice',
        lastName: 'Smith',
        appointments: [
          makeAppointment({
            courtId: 'NYSB',
            courtName: 'Southern District of New York',
            divisionCodes: ['081', '087'],
          }),
        ],
      });
      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({ data: [trustee] });

      renderWithRouter(<TrusteesList />);

      await waitFor(() => {
        const divisionCell = document.querySelector('[data-cell="Division"]') as HTMLElement;
        expect(divisionCell).toBeInTheDocument();
        expect(within(divisionCell).getByText('All')).toBeInTheDocument();
      });
    });

    test('should display specific division names for partial assignments', async () => {
      vi.spyOn(FeatureFlagHook, 'default').mockReturnValue({
        'trustee-district-division': true,
      } as FeatureFlagSet);

      const trustee = makeListItem({
        trusteeId: 't1',
        firstName: 'Alice',
        lastName: 'Smith',
        appointments: [
          makeAppointment({
            courtId: 'NYSB',
            courtName: 'Southern District of New York',
            divisionCodes: ['081'],
          }),
        ],
      });
      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({ data: [trustee] });

      renderWithRouter(<TrusteesList />);

      await waitFor(() => {
        const divisionCell = document.querySelector('[data-cell="Division"]') as HTMLElement;
        expect(divisionCell).toBeInTheDocument();
        expect(within(divisionCell).getByText('Manhattan')).toBeInTheDocument();
      });
    });

    test('should display legacy courtDivisionName when no divisionCodes exist', async () => {
      vi.spyOn(FeatureFlagHook, 'default').mockReturnValue({
        'trustee-district-division': true,
      } as FeatureFlagSet);

      const trustee = makeListItem({
        trusteeId: 't1',
        firstName: 'Alice',
        lastName: 'Smith',
        appointments: [
          makeAppointment({
            courtId: 'NYSB',
            courtName: 'Southern District of New York',
            courtDivisionName: 'Manhattan',
            divisionCode: '081',
            divisionCodes: undefined,
          }),
        ],
      });
      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({ data: [trustee] });

      renderWithRouter(<TrusteesList />);

      await waitFor(() => {
        const divisionCell = document.querySelector('[data-cell="Division"]') as HTMLElement;
        expect(divisionCell).toBeInTheDocument();
        expect(within(divisionCell).getByText('Manhattan')).toBeInTheDocument();
      });
    });
  });

  describe('Division Filter (Slice 3, flag ON)', () => {
    const nysbCourts = [
      {
        courtId: 'NYSB',
        courtName: 'Southern District of New York',
        officeCode: '081',
        officeName: 'Manhattan',
        courtDivisionCode: '081',
        courtDivisionName: 'Manhattan',
        groupDesignator: 'NY',
        regionId: '02',
        regionName: 'New York Region',
      },
      {
        courtId: 'NYSB',
        courtName: 'Southern District of New York',
        officeCode: '087',
        officeName: 'White Plains',
        courtDivisionCode: '087',
        courtDivisionName: 'White Plains',
        groupDesignator: 'NY',
        regionId: '02',
        regionName: 'New York Region',
      },
    ];

    const nysbSession = {
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
        ],
      },
    };

    beforeEach(() => {
      vi.spyOn(FeatureFlagHook, 'default').mockReturnValue({
        'trustee-district-division': true,
      } as FeatureFlagSet);
      vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: nysbCourts });
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(nysbSession);
    });

    test('filterTrustees: filters by specific division code when flag ON and combined filter selected', async () => {
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);

      const apptManhattan = makeAppointment({
        courtId: 'NYSB',
        divisionCodes: ['081'],
      });
      const apptWhitePlains = makeAppointment({
        courtId: 'NYSB',
        divisionCodes: ['087'],
      });
      const trusteeManhattan = makeListItem({
        trusteeId: 'manhattan',
        firstName: 'Alice',
        lastName: 'Manhattan',
        appointments: [apptManhattan],
      });
      const trusteeWhitePlains = makeListItem({
        trusteeId: 'whiteplains',
        firstName: 'Bob',
        lastName: 'WhitePlains',
        appointments: [apptWhitePlains],
      });

      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({
        data: [trusteeManhattan, trusteeWhitePlains],
      });

      renderWithRouter(<TrusteesList />);

      await waitFor(() => {
        expect(screen.getByText('2 Trustee(s)', { selector: 'p' })).toBeInTheDocument();
      });

      const toggleButton = screen.getByRole('button', { name: /filters/i });
      await userEvent.setup().click(toggleButton);

      await waitFor(() => {
        expect(screen.getByLabelText('District (Division)')).toBeInTheDocument();
      });

      const combinedCombobox = screen.getByLabelText('District (Division)');
      await userEvent.setup().click(combinedCombobox);

      await waitFor(() => {
        expect(
          screen.getByRole('option', {
            name: /option: Southern District of New York \(Manhattan\)/i,
          }),
        ).toBeInTheDocument();
      });

      await userEvent.setup().click(
        screen.getByRole('option', {
          name: /option: Southern District of New York \(Manhattan\)/i,
        }),
      );

      await waitFor(() => {
        expect(screen.getByText('1 Trustee(s)', { selector: 'p' })).toBeInTheDocument();
        expect(screen.getByText('Manhattan, Alice')).toBeInTheDocument();
        expect(screen.queryByText('WhitePlains, Bob')).not.toBeInTheDocument();
      });
    });

    test('filterTrustees: "All Divisions" trustee (empty divisionCodes) always matches any division selection', async () => {
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);

      const apptAllDivisions = makeAppointment({
        courtId: 'NYSB',
        divisionCodes: [],
      });
      const apptSpecific = makeAppointment({
        courtId: 'NYSB',
        divisionCodes: ['087'],
      });
      const trusteeAllDivisions = makeListItem({
        trusteeId: 'alldiv',
        firstName: 'Alice',
        lastName: 'AllDivisions',
        appointments: [apptAllDivisions],
      });
      const trusteeSpecific = makeListItem({
        trusteeId: 'specific',
        firstName: 'Bob',
        lastName: 'WhitePlains',
        appointments: [apptSpecific],
      });

      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({
        data: [trusteeAllDivisions, trusteeSpecific],
      });

      renderWithRouter(<TrusteesList />);

      await waitFor(() => {
        expect(screen.getByText('2 Trustee(s)', { selector: 'p' })).toBeInTheDocument();
      });

      const toggleButton = screen.getByRole('button', { name: /filters/i });
      await userEvent.setup().click(toggleButton);

      await waitFor(() => {
        expect(screen.getByLabelText('District (Division)')).toBeInTheDocument();
      });

      const combinedCombobox = screen.getByLabelText('District (Division)');
      await userEvent.setup().click(combinedCombobox);

      await waitFor(() => {
        expect(
          screen.getByRole('option', {
            name: /option: Southern District of New York \(White Plains\)/i,
          }),
        ).toBeInTheDocument();
      });

      await userEvent.setup().click(
        screen.getByRole('option', {
          name: /option: Southern District of New York \(White Plains\)/i,
        }),
      );

      await waitFor(() => {
        expect(screen.getByText('2 Trustee(s)', { selector: 'p' })).toBeInTheDocument();
        expect(screen.getByText('AllDivisions, Alice')).toBeInTheDocument();
        expect(screen.getByText('WhitePlains, Bob')).toBeInTheDocument();
      });
    });

    test('combined district/division filter shown when flag is ON', async () => {
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);
      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({
        data: [makeListItem({ trusteeId: 't1' })],
      });

      renderWithRouter(<TrusteesList />);

      await waitFor(() => {
        expect(screen.getByText('1 Trustee(s)', { selector: 'p' })).toBeInTheDocument();
      });

      const toggleButton = screen.getByRole('button', { name: /filters/i });
      await userEvent.setup().click(toggleButton);

      await waitFor(() => {
        expect(screen.getByLabelText('District (Division)')).toBeInTheDocument();
      });

      expect(screen.queryByLabelText('District')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Division')).not.toBeInTheDocument();
    });

    test('combined filter shows all district/division options', async () => {
      const appt = makeAppointment({ courtId: 'NYSB', divisionCodes: ['081'] });
      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({
        data: [makeListItem({ trusteeId: 't1', appointments: [appt] })],
      });

      renderWithRouter(<TrusteesList />);

      await waitFor(() => {
        expect(screen.getByText('1 Trustee(s)', { selector: 'p' })).toBeInTheDocument();
      });

      const toggleButton = screen.getByRole('button', { name: /filters/i });
      await userEvent.setup().click(toggleButton);

      await waitFor(() => {
        expect(screen.getByLabelText('District (Division)')).toBeInTheDocument();
      });

      const combinedCombobox = screen.getByLabelText('District (Division)');
      await userEvent.setup().click(combinedCombobox);

      await waitFor(() => {
        expect(
          screen.getByRole('option', {
            name: /option: Southern District of New York \(All\)/i,
          }),
        ).toBeInTheDocument();
        expect(
          screen.getByRole('option', {
            name: /option: Southern District of New York \(Manhattan\)/i,
          }),
        ).toBeInTheDocument();
        expect(
          screen.getByRole('option', {
            name: /option: Southern District of New York \(White Plains\)/i,
          }),
        ).toBeInTheDocument();
      });
    });

    test('selecting All after specific division shows all trustees in that court', async () => {
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);

      const apptManhattan = makeAppointment({ courtId: 'NYSB', divisionCodes: ['081'] });
      const apptWhitePlains = makeAppointment({ courtId: 'NYSB', divisionCodes: ['087'] });
      const trusteeManhattan = makeListItem({
        trusteeId: 'manhattan',
        firstName: 'Alice',
        lastName: 'Manhattan',
        appointments: [apptManhattan],
      });
      const trusteeWhitePlains = makeListItem({
        trusteeId: 'whiteplains',
        firstName: 'Bob',
        lastName: 'WhitePlains',
        appointments: [apptWhitePlains],
      });

      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({
        data: [trusteeManhattan, trusteeWhitePlains],
      });

      renderWithRouter(<TrusteesList />);

      await waitFor(() => {
        expect(screen.getByText('2 Trustee(s)', { selector: 'p' })).toBeInTheDocument();
      });

      const toggleButton = screen.getByRole('button', { name: /filters/i });
      await userEvent.setup().click(toggleButton);

      await waitFor(() => {
        expect(screen.getByLabelText('District (Division)')).toBeInTheDocument();
      });

      const combinedCombobox = screen.getByLabelText('District (Division)');
      await userEvent.setup().click(combinedCombobox);

      await waitFor(() => {
        expect(
          screen.getByRole('option', {
            name: /option: Southern District of New York \(Manhattan\)/i,
          }),
        ).toBeInTheDocument();
      });
      await userEvent.setup().click(
        screen.getByRole('option', {
          name: /option: Southern District of New York \(Manhattan\)/i,
        }),
      );

      await waitFor(() => {
        expect(screen.getByText('1 Trustee(s)', { selector: 'p' })).toBeInTheDocument();
        expect(screen.getByText('Manhattan, Alice')).toBeInTheDocument();
        expect(screen.queryByText('WhitePlains, Bob')).not.toBeInTheDocument();
      });

      const manhattanPill = screen.getByRole('button', {
        name: /southern district of new york \(manhattan\) selected.*click to deselect/i,
      });
      await userEvent.setup().click(manhattanPill);

      await waitFor(() => {
        expect(screen.getByText('2 Trustee(s)', { selector: 'p' })).toBeInTheDocument();
        expect(screen.getByText('Manhattan, Alice')).toBeInTheDocument();
        expect(screen.getByText('WhitePlains, Bob')).toBeInTheDocument();
      });
    });

    test('clearing all combined selections shows all trustees', async () => {
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);

      const apptNY = makeAppointment({ courtId: 'NYSB', divisionCodes: ['081'] });
      const trusteeNY = makeListItem({
        trusteeId: 'ny',
        firstName: 'Alice',
        lastName: 'New York',
        appointments: [apptNY],
      });

      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({ data: [trusteeNY] });

      renderWithRouter(<TrusteesList />);

      await waitFor(() => {
        expect(screen.getByText('1 Trustee(s)', { selector: 'p' })).toBeInTheDocument();
      });

      const toggleButton = screen.getByRole('button', { name: /filters/i });
      await userEvent.setup().click(toggleButton);

      await waitFor(() => {
        expect(screen.getByLabelText('District (Division)')).toBeInTheDocument();
      });

      const combinedCombobox = screen.getByLabelText('District (Division)');
      await userEvent.setup().click(combinedCombobox);

      await waitFor(() => {
        expect(
          screen.getByRole('option', {
            name: /option: Southern District of New York \(Manhattan\)/i,
          }),
        ).toBeInTheDocument();
      });

      await userEvent.setup().click(
        screen.getByRole('option', {
          name: /option: Southern District of New York \(Manhattan\)/i,
        }),
      );

      await waitFor(() => {
        expect(
          screen.getByRole('button', {
            name: /southern district of new york \(manhattan\) selected.*click to deselect/i,
          }),
        ).toBeInTheDocument();
      });

      const divisionPill = screen.getByRole('button', {
        name: /southern district of new york \(manhattan\) selected.*click to deselect/i,
      });
      await userEvent.setup().click(divisionPill);

      await waitFor(() => {
        expect(
          screen.queryByRole('button', {
            name: /southern district of new york \(manhattan\) selected.*click to deselect/i,
          }),
        ).not.toBeInTheDocument();
      });
    });

    test('flag ON: clearing all combined filter selections reveals trustees from all districts', async () => {
      // Regression: with flag ON, selectedDistricts (set by session default) was silently applied
      // even though the district combo was not accessible in the UI. Clearing selectedDivisions
      // back to [] must show ALL trustees, not just those in the session's district.
      const trusteeManhattan = makeListItem({
        trusteeId: 'manhattan',
        firstName: 'Alice',
        lastName: 'Manhattan',
        appointments: [makeAppointment({ courtId: 'NYSB', divisionCodes: ['081'] })],
      });
      const trusteeOtherDistrict = makeListItem({
        trusteeId: 'other',
        firstName: 'Out',
        lastName: 'OfDistrict',
        appointments: [makeAppointment({ courtId: 'CAB', divisionCodes: ['099'] })],
      });

      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({
        data: [trusteeManhattan, trusteeOtherDistrict],
      });

      renderWithRouter(<TrusteesList />);

      // Session default (NYSB Manhattan) is applied on mount — only Manhattan trustee visible
      await waitFor(() => {
        expect(screen.getByText('1 Trustee(s)', { selector: 'p' })).toBeInTheDocument();
        expect(screen.getByText('Manhattan, Alice')).toBeInTheDocument();
        expect(screen.queryByText('OfDistrict, Out')).not.toBeInTheDocument();
      });

      // Expand filters to access pills
      const toggleButton = screen.getByRole('button', { name: /filters/i });
      await userEvent.setup().click(toggleButton);

      // Remove the default Manhattan division pill — clears selectedDivisions to []
      const pill = await screen.findByRole('button', {
        name: /southern district of new york \(manhattan\) selected.*click to deselect/i,
      });
      await userEvent.setup().click(pill);

      // With no active filters, trustees from ALL districts must appear.
      // The bug would have kept selectedDistricts = [NYSB] active, showing only 1 trustee.
      await waitFor(() => {
        expect(screen.getByText('2 Trustee(s)', { selector: 'p' })).toBeInTheDocument();
        expect(screen.getByText('Manhattan, Alice')).toBeInTheDocument();
        expect(screen.getByText('OfDistrict, Out')).toBeInTheDocument();
      });
    });

    test('defaults to user session divisions when flag is ON', async () => {
      const apptManhattan = makeAppointment({ courtId: 'NYSB', divisionCodes: ['081'] });
      const apptWhitePlains = makeAppointment({ courtId: 'NYSB', divisionCodes: ['087'] });
      const trusteeManhattan = makeListItem({
        trusteeId: 'manhattan',
        firstName: 'Alice',
        lastName: 'Manhattan',
        appointments: [apptManhattan],
      });
      const trusteeWhitePlains = makeListItem({
        trusteeId: 'whiteplains',
        firstName: 'Bob',
        lastName: 'WhitePlains',
        appointments: [apptWhitePlains],
      });

      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({
        data: [trusteeManhattan, trusteeWhitePlains],
      });

      renderWithRouter(<TrusteesList />);

      await waitFor(() => {
        expect(screen.getByText('1 Trustee(s)', { selector: 'p' })).toBeInTheDocument();
        expect(screen.getByText('Manhattan, Alice')).toBeInTheDocument();
        expect(screen.queryByText('WhitePlains, Bob')).not.toBeInTheDocument();
      });

      const toggleButton = screen.getByRole('button', { name: /filters/i });
      await userEvent.setup().click(toggleButton);

      await waitFor(() => {
        expect(
          screen.getByRole('button', {
            name: /southern district of new york \(manhattan\) selected.*click to deselect/i,
          }),
        ).toBeInTheDocument();
      });
    });

    test('default session divisions appear at top of combined dropdown with divider', async () => {
      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({
        data: [makeListItem({ trusteeId: 't1' })],
      });

      renderWithRouter(<TrusteesList />);

      await waitFor(() => {
        expect(screen.getByText('1 Trustee(s)', { selector: 'p' })).toBeInTheDocument();
      });

      const toggleButton = screen.getByRole('button', { name: /filters/i });
      await userEvent.setup().click(toggleButton);

      await waitFor(() => {
        expect(screen.getByLabelText('District (Division)')).toBeInTheDocument();
      });

      const combinedCombobox = screen.getByLabelText('District (Division)');
      await userEvent.setup().click(combinedCombobox);

      await waitFor(() => {
        expect(
          screen.getByRole('option', {
            name: /option: Southern District of New York \(Manhattan\)/i,
          }),
        ).toBeInTheDocument();
      });

      const allOptions = screen.getAllByRole('option');
      const manhattanIndex = allOptions.findIndex((o) =>
        o.textContent?.includes('Southern District of New York (Manhattan)'),
      );
      const vermontIndex = allOptions.findIndex((o) =>
        o.textContent?.includes('District of Vermont'),
      );

      expect(manhattanIndex).toBeGreaterThanOrEqual(0);
      if (vermontIndex >= 0) {
        expect(manhattanIndex).toBeLessThan(vermontIndex);
      }
    });

    test('division filter not shown when feature flag is OFF', async () => {
      vi.spyOn(FeatureFlagHook, 'default').mockReturnValue({
        'trustee-district-division': false,
      } as FeatureFlagSet);

      const appt = makeAppointment({ courtId: 'NYSB', divisionCode: '081' });
      vi.spyOn(Api2, 'getTrustees').mockResolvedValue({
        data: [makeListItem({ trusteeId: 't1', appointments: [appt] })],
      });

      renderWithRouter(<TrusteesList />);

      await waitFor(() => {
        expect(screen.getByText('1 Trustee(s)', { selector: 'p' })).toBeInTheDocument();
      });

      const toggleButton = screen.getByRole('button', { name: /filters/i });
      await userEvent.setup().click(toggleButton);

      await waitFor(() => {
        expect(screen.getByLabelText('District')).toBeInTheDocument();
      });

      expect(screen.queryByLabelText('Division')).not.toBeInTheDocument();
    });
  });
});
