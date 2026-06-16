import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import TrusteesList from './TrusteesList';
import Api2 from '@/lib/models/api2';
import { TrusteeListItem } from '@common/cams/trustees';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import { vi } from 'vitest';
import MockData from '@common/cams/test-utilities/mock-data';
import { CamsRole } from '@common/cams/roles';
import LocalStorage from '@/lib/utils/local-storage';
import React from 'react';

const mockTrackEvent = vi.fn();
vi.mock('@/lib/hooks/UseApplicationInsights', () => ({
  getAppInsights: () => ({
    appInsights: { trackEvent: mockTrackEvent },
  }),
}));

vi.mock('launchdarkly-react-client-sdk', () => ({
  useFlags: vi.fn(() => ({})),
  withLDProvider: vi.fn(() => (component: unknown) => component),
}));

vi.mock('@/lib/hooks/UseFeatureFlags', () => ({
  default: vi.fn(() => ({ 'transfer-orders-enabled': true })),
  TRUSTEE_DISTRICT_DIVISION: 'trustee-district-division',
  TRANSFER_ORDERS_ENABLED: 'transfer-orders-enabled',
  SYSTEM_MAINTENANCE_BANNER: 'system-maintenance-banner',
  TRUSTEE_MANAGEMENT: 'trustee-management',
}));

function renderWithRouter(component: React.ReactElement) {
  return render(<BrowserRouter>{component}</BrowserRouter>);
}

function makeListItem(overrides: Partial<TrusteeListItem> = {}): TrusteeListItem {
  return {
    ...MockData.getTrustee(),
    appointments: [MockData.getTrusteeAppointment()],
    ...overrides,
  };
}

function makeAppointment(overrides: Partial<TrusteeAppointment> = {}): TrusteeAppointment {
  return MockData.getTrusteeAppointment(overrides);
}

describe('TrusteesList Status Filter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTrackEvent.mockReset();
    const user = MockData.getCamsUser({ roles: [CamsRole.TrusteeAdmin] });
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(MockData.getCamsSession({ user }));
    vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should default to Active and hide trustees with only inactive appointments', async () => {
    const activeTrustee = makeListItem({
      trusteeId: 'active-1',
      firstName: 'Alice',
      lastName: 'Active',
      name: 'Alice Active',
      appointments: [makeAppointment({ trusteeId: 'active-1', status: 'active' })],
    });
    vi.spyOn(Api2, 'getTrustees').mockResolvedValue({
      data: [activeTrustee],
    });

    renderWithRouter(<TrusteesList />);

    await waitFor(() => {
      expect(screen.getByText('1 Trustee', { selector: 'p' })).toBeInTheDocument();
    });
    expect(screen.getByTestId('trustee-link-active-1')).toBeInTheDocument();
    expect(screen.queryByTestId('trustee-link-inactive-1')).not.toBeInTheDocument();
  });

  test('should show only inactive trustees when Inactive is selected', async () => {
    const activeTrustee = makeListItem({
      trusteeId: 'active-1',
      firstName: 'Alice',
      lastName: 'Active',
      name: 'Alice Active',
      appointments: [makeAppointment({ trusteeId: 'active-1', status: 'active' })],
    });
    const inactiveTrustee = makeListItem({
      trusteeId: 'inactive-1',
      firstName: 'Bob',
      lastName: 'Inactive',
      name: 'Bob Inactive',
      appointments: [makeAppointment({ trusteeId: 'inactive-1', status: 'resigned' })],
    });
    const spy = vi.spyOn(Api2, 'getTrustees');
    spy.mockResolvedValue({ data: [activeTrustee] });

    renderWithRouter(<TrusteesList />);

    await waitFor(() => {
      expect(screen.getByText('1 Trustee', { selector: 'p' })).toBeInTheDocument();
    });

    spy.mockResolvedValue({ data: [inactiveTrustee] });

    const user = userEvent.setup();
    const toggleButton = screen.getByRole('button', { name: /filters/i });
    await user.click(toggleButton);

    const statusCombobox = await screen.findByLabelText('Status');
    await user.click(statusCombobox);

    const inactiveOption = await screen.findByRole('option', { name: /Status Inactive/i });
    await user.click(inactiveOption);

    await waitFor(() => {
      expect(screen.getByText('1 Trustee', { selector: 'p' })).toBeInTheDocument();
      expect(screen.queryByTestId('trustee-link-active-1')).not.toBeInTheDocument();
      expect(screen.getByTestId('trustee-link-inactive-1')).toBeInTheDocument();
    });
    expect(spy).toHaveBeenLastCalledWith('inactive');
  });

  test('should show all trustees when All is selected', async () => {
    const activeTrustee = makeListItem({
      trusteeId: 'active-1',
      firstName: 'Alice',
      lastName: 'Active',
      name: 'Alice Active',
      appointments: [makeAppointment({ trusteeId: 'active-1', status: 'active' })],
    });
    const inactiveTrustee = makeListItem({
      trusteeId: 'inactive-1',
      firstName: 'Bob',
      lastName: 'Inactive',
      name: 'Bob Inactive',
      appointments: [makeAppointment({ trusteeId: 'inactive-1', status: 'terminated' })],
    });
    const spy = vi.spyOn(Api2, 'getTrustees');
    spy.mockResolvedValue({ data: [activeTrustee] });

    renderWithRouter(<TrusteesList />);

    await waitFor(() => {
      expect(screen.getByText('1 Trustee', { selector: 'p' })).toBeInTheDocument();
    });

    spy.mockResolvedValue({ data: [activeTrustee, inactiveTrustee] });

    const user = userEvent.setup();
    const toggleButton = screen.getByRole('button', { name: /filters/i });
    await user.click(toggleButton);

    const statusCombobox = await screen.findByLabelText('Status');
    await user.click(statusCombobox);

    const allOption = await screen.findByRole('option', { name: /Status All/i });
    await user.click(allOption);

    await waitFor(() => {
      expect(screen.getByText('2 Trustees', { selector: 'p' })).toBeInTheDocument();
      expect(screen.getByTestId('trustee-link-active-1')).toBeInTheDocument();
      expect(screen.getByTestId('trustee-link-inactive-1')).toBeInTheDocument();
    });
    expect(spy).toHaveBeenLastCalledWith('all');
  });

  test('should show trustee with mixed-status appointments in both Active and Inactive views', async () => {
    const mixedTrustee = makeListItem({
      trusteeId: 'mixed-1',
      firstName: 'Mixed',
      lastName: 'Status',
      name: 'Mixed Status',
      appointments: [
        makeAppointment({ trusteeId: 'mixed-1', status: 'active' }),
        makeAppointment({ trusteeId: 'mixed-1', status: 'resigned' }),
      ],
    });
    vi.spyOn(Api2, 'getTrustees').mockResolvedValue({ data: [mixedTrustee] });

    renderWithRouter(<TrusteesList />);

    await waitFor(() => {
      expect(screen.getByText('1 Trustee', { selector: 'p' })).toBeInTheDocument();
      expect(screen.getByTestId('trustee-link-mixed-1')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    const toggleButton = screen.getByRole('button', { name: /filters/i });
    await user.click(toggleButton);

    const statusCombobox = await screen.findByLabelText('Status');
    await user.click(statusCombobox);

    const inactiveOption = await screen.findByRole('option', { name: /Status Inactive/i });
    await user.click(inactiveOption);

    await waitFor(() => {
      expect(screen.getByText('1 Trustee', { selector: 'p' })).toBeInTheDocument();
      expect(screen.getByTestId('trustee-link-mixed-1')).toBeInTheDocument();
    });
  });

  test('should apply status and chapter filters together', async () => {
    const activeChapter7 = makeListItem({
      trusteeId: 'ac7',
      firstName: 'Active',
      lastName: 'Seven',
      name: 'Active Seven',
      appointments: [makeAppointment({ trusteeId: 'ac7', status: 'active', chapter: '7' })],
    });
    const activeChapter13 = makeListItem({
      trusteeId: 'ac13',
      firstName: 'Active',
      lastName: 'Thirteen',
      name: 'Active Thirteen',
      appointments: [makeAppointment({ trusteeId: 'ac13', status: 'active', chapter: '13' })],
    });
    vi.spyOn(Api2, 'getTrustees').mockResolvedValue({
      data: [activeChapter7, activeChapter13],
    });

    renderWithRouter(<TrusteesList />);

    await waitFor(() => {
      expect(screen.getByText('2 Trustees', { selector: 'p' })).toBeInTheDocument();
    });

    const toggleButton = screen.getByRole('button', { name: /filters/i });
    const user = userEvent.setup();
    await user.click(toggleButton);

    const chapterCombobox = await screen.findByLabelText('Chapter');
    await user.click(chapterCombobox);
    const chapter7Option = await screen.findByRole('option', { name: /Chapter 7/i });
    await user.click(chapter7Option);

    await waitFor(() => {
      expect(screen.getByText('1 Trustee', { selector: 'p' })).toBeInTheDocument();
      expect(screen.getByTestId('trustee-link-ac7')).toBeInTheDocument();
      expect(screen.queryByTestId('trustee-link-ac13')).not.toBeInTheDocument();
    });
  });

  test('should keep filters accordion open and chapter selection when status changes', async () => {
    const activeChapter7 = makeListItem({
      trusteeId: 'ac7',
      firstName: 'Active',
      lastName: 'Seven',
      name: 'Active Seven',
      appointments: [makeAppointment({ trusteeId: 'ac7', status: 'active', chapter: '7' })],
    });
    const inactiveChapter7 = makeListItem({
      trusteeId: 'ic7',
      firstName: 'Inactive',
      lastName: 'Seven',
      name: 'Inactive Seven',
      appointments: [makeAppointment({ trusteeId: 'ic7', status: 'resigned', chapter: '7' })],
    });
    const spy = vi.spyOn(Api2, 'getTrustees');
    spy.mockResolvedValue({ data: [activeChapter7] });

    renderWithRouter(<TrusteesList />);

    await waitFor(() => {
      expect(screen.getByText('1 Trustee', { selector: 'p' })).toBeInTheDocument();
    });

    const user = userEvent.setup();
    const toggleButton = screen.getByRole('button', { name: /filters/i });
    await user.click(toggleButton);

    // Select a chapter filter
    const chapterCombobox = await screen.findByLabelText('Chapter');
    await user.click(chapterCombobox);
    const chapter7Option = await screen.findByRole('option', { name: /Chapter 7/i });
    await user.click(chapter7Option);

    // The chapter pill should now be present
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /^7 selected\. click to deselect\./i }),
      ).toBeInTheDocument();
    });

    // Now change the status filter
    spy.mockResolvedValue({ data: [inactiveChapter7] });
    const statusCombobox = await screen.findByLabelText('Status');
    await user.click(statusCombobox);
    const inactiveOption = await screen.findByRole('option', { name: /Status Inactive/i });
    await user.click(inactiveOption);

    await waitFor(() => {
      expect(spy).toHaveBeenLastCalledWith('inactive');
      expect(screen.getByTestId('trustee-link-ic7')).toBeInTheDocument();
    });

    // The accordion content should remain expanded (not collapsed by the reload)
    expect(screen.getByLabelText('Chapter')).toBeVisible();

    // The chapter selection should still be applied (pill still present)
    expect(
      screen.getByRole('button', { name: /^7 selected\. click to deselect\./i }),
    ).toBeInTheDocument();
  });
});
