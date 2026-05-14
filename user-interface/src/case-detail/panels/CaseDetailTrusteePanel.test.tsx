import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import CaseDetailTrusteePanel from './CaseDetailTrusteePanel';
import MockData from '@common/cams/test-utilities/mock-data';
import { ZoomInfo } from '@common/cams/trustees';
import { CamsRole } from '@common/cams/roles';
import LocalStorage from '@/lib/utils/local-storage';

vi.mock('./useTrustee', () => ({
  useTrustee: vi.fn(),
}));

vi.mock('./useCaseAppointment', () => ({
  useCaseAppointment: vi.fn(),
}));

vi.mock('@/lib/hooks/UseFeatureFlags', () => ({
  default: vi.fn(),
  TRUSTEE_APPOINTMENT_HISTORY_ENABLED: 'trustee-appointment-history-enabled',
}));

import { useTrustee } from './useTrustee';
import { useCaseAppointment } from './useCaseAppointment';
import useFeatureFlags, { TRUSTEE_APPOINTMENT_HISTORY_ENABLED } from '@/lib/hooks/UseFeatureFlags';

const mockTrackEvent = vi.fn();
vi.mock('@/lib/hooks/UseApplicationInsights', () => ({
  getAppInsights: () => ({
    appInsights: { trackEvent: mockTrackEvent },
  }),
}));

const mockUseTrustee = vi.mocked(useTrustee);
const mockUseCaseAppointment = vi.mocked(useCaseAppointment);
const mockUseFeatureFlags = vi.mocked(useFeatureFlags);

function renderPanel() {
  const caseDetail = MockData.getCaseDetail();
  render(
    <BrowserRouter>
      <CaseDetailTrusteePanel caseDetail={caseDetail} />
    </BrowserRouter>,
  );
}

function setupLoadedTrustee(overrides = {}) {
  const trustee = MockData.getTrustee();
  mockUseCaseAppointment.mockReturnValue({
    appointedDate: null,
    trusteeId: trustee.trusteeId,
    history: [],
    loading: false,
    ...overrides,
  });
  mockUseTrustee.mockReturnValue({ trustee, loading: false });
  return { trustee };
}

describe('CaseDetailTrusteePanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetAllMocks();
    const user = MockData.getCamsUser({ roles: [CamsRole.TrusteeAdmin] });
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(MockData.getCamsSession({ user }));
    mockUseFeatureFlags.mockReturnValue({
      [TRUSTEE_APPOINTMENT_HISTORY_ENABLED]: false,
    });
    mockUseCaseAppointment.mockReturnValue({
      appointedDate: null,
      trusteeId: null,
      history: [],
      loading: false,
    });
    mockUseTrustee.mockReturnValue({ trustee: null, loading: false });
  });

  test('renders plain text message when no active appointment exists', () => {
    mockUseCaseAppointment.mockReturnValue({
      appointedDate: null,
      trusteeId: null,
      history: [],
      loading: false,
    });

    renderPanel();

    expect(screen.getByTestId('case-detail-trustee-panel-empty')).toBeInTheDocument();
    expect(screen.getByText('No Trustee has been appointed for this case.')).toBeInTheDocument();
    expect(screen.queryByTestId('case-trustee-card')).not.toBeInTheDocument();
  });

  test('renders loading state while appointment is fetching', () => {
    mockUseCaseAppointment.mockReturnValue({
      appointedDate: null,
      trusteeId: null,
      history: [],
      loading: true,
    });

    renderPanel();

    expect(screen.getByTestId('case-detail-trustee-panel-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('case-trustee-card')).not.toBeInTheDocument();
  });

  test('renders loading state while trustee is fetching', () => {
    mockUseCaseAppointment.mockReturnValue({
      appointedDate: null,
      trusteeId: 'trustee-001',
      history: [],
      loading: false,
    });
    mockUseTrustee.mockReturnValue({ trustee: null, loading: true });

    renderPanel();

    expect(screen.getByTestId('case-detail-trustee-panel-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('case-trustee-card')).not.toBeInTheDocument();
  });

  test('renders no-info state when trustee fetch returns null', () => {
    mockUseCaseAppointment.mockReturnValue({
      appointedDate: null,
      trusteeId: 'trustee-001',
      history: [],
      loading: false,
    });
    mockUseTrustee.mockReturnValue({ trustee: null, loading: false });

    renderPanel();

    expect(screen.getByTestId('case-detail-trustee-panel-no-info')).toBeInTheDocument();
    expect(screen.queryByTestId('case-trustee-card')).not.toBeInTheDocument();
  });

  test('renders trustee card when trustee is loaded', () => {
    setupLoadedTrustee();

    renderPanel();

    expect(screen.getByTestId('case-trustee-card')).toBeInTheDocument();
  });

  test('renders trustee name as link to trustee profile', () => {
    const { trustee } = setupLoadedTrustee();

    renderPanel();

    const link = screen.getByTestId('case-detail-trustee-link');
    expect(link).toHaveAttribute('href', `/trustees/${trustee.trusteeId}`);
  });

  test('passes public contact to FormattedContact', () => {
    setupLoadedTrustee();

    renderPanel();

    expect(screen.getByTestId('case-trustee-public-contact')).toBeInTheDocument();
  });

  test('renders heading with trustee name when trustee is loaded', () => {
    const { trustee } = setupLoadedTrustee();

    renderPanel();

    expect(screen.getByTestId('case-detail-trustee-panel-heading')).toHaveTextContent(
      `Trustee - ${trustee.name}`,
    );
  });

  test('renders ContactInformationCard when trustee is loaded', () => {
    setupLoadedTrustee();

    renderPanel();

    expect(screen.getByText('Internal use only.')).toBeInTheDocument();
  });

  test('renders MeetingOfCreditorsInfoCard when trustee is loaded', () => {
    setupLoadedTrustee();

    renderPanel();

    expect(screen.getByTestId('zoom-info-card')).toBeInTheDocument();
  });

  test('passes undefined zoomInfo to MeetingOfCreditorsInfoCard when trustee has none', () => {
    const trustee = MockData.getTrustee({ zoomInfo: undefined });
    mockUseCaseAppointment.mockReturnValue({
      appointedDate: null,
      trusteeId: trustee.trusteeId,
      history: [],
      loading: false,
    });
    mockUseTrustee.mockReturnValue({ trustee, loading: false });

    renderPanel();

    expect(screen.getByTestId('zoom-info-card')).toBeInTheDocument();
  });

  test('passes zoomInfo to MeetingOfCreditorsInfoCard when trustee has zoomInfo', () => {
    const zoomInfo: ZoomInfo = {
      link: 'https://zoom.us/j/123456789',
      phone: '1-555-123-4567',
      meetingId: '123456789',
      passcode: 'abc123',
    };
    const trustee = MockData.getTrustee({ zoomInfo });
    mockUseCaseAppointment.mockReturnValue({
      appointedDate: null,
      trusteeId: trustee.trusteeId,
      history: [],
      loading: false,
    });
    mockUseTrustee.mockReturnValue({ trustee, loading: false });

    renderPanel();

    expect(screen.getByTestId('zoom-info-card')).toBeInTheDocument();
  });

  test('renders appointed date when appointedDate is present', () => {
    setupLoadedTrustee({ appointedDate: '2026-04-07' });

    renderPanel();

    expect(screen.getByTestId('case-detail-trustee-panel-appointed-date')).toHaveTextContent(
      'Appointed: 04/07/2026',
    );
  });

  test('does not render appointed date when appointedDate is null', () => {
    setupLoadedTrustee();

    renderPanel();

    expect(
      screen.queryByTestId('case-detail-trustee-panel-appointed-date'),
    ).not.toBeInTheDocument();
  });

  test('does not render appointed date when date is invalid', () => {
    setupLoadedTrustee({ appointedDate: 'invalid-date-string' });

    renderPanel();

    expect(
      screen.queryByTestId('case-detail-trustee-panel-appointed-date'),
    ).not.toBeInTheDocument();
  });

  test('fires "Trustee Info Viewed" telemetry event when trustee loads', () => {
    setupLoadedTrustee();

    renderPanel();

    expect(mockTrackEvent).toHaveBeenCalledWith({ name: 'Trustee Info Viewed' });
  });

  test('does not fire "Trustee Info Viewed" telemetry when trustee is null', () => {
    mockUseCaseAppointment.mockReturnValue({
      appointedDate: null,
      trusteeId: null,
      history: [],
      loading: false,
    });
    mockUseTrustee.mockReturnValue({ trustee: null, loading: false });

    renderPanel();

    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  describe('Past Trustees section', () => {
    test('renders past trustees table when flag is on and history is non-empty', () => {
      mockUseFeatureFlags.mockReturnValue({
        [TRUSTEE_APPOINTMENT_HISTORY_ENABLED]: true,
      });
      const trustee = MockData.getTrustee();
      const history = [
        {
          id: 'ca-past-1',
          caseId: '111-24-00001',
          trusteeId: 'trustee-past-1',
          trusteeName: 'Past Trustee One',
          assignedOn: '2025-01-01T00:00:00Z',
          appointedDate: '2025-04-01',
          unassignedOn: '2025-12-31T00:00:00Z',
          createdOn: '2025-01-01T00:00:00Z',
          createdBy: { id: 'system', name: 'System' },
          updatedOn: '2025-01-01T00:00:00Z',
          updatedBy: { id: 'system', name: 'System' },
        },
      ];
      mockUseCaseAppointment.mockReturnValue({
        appointedDate: null,
        trusteeId: trustee.trusteeId,
        history,
        loading: false,
      });
      mockUseTrustee.mockReturnValue({ trustee, loading: false });

      renderPanel();

      expect(screen.getByTestId('past-trustees-section')).toBeInTheDocument();
      expect(screen.getByText('Past Trustees')).toBeInTheDocument();
      expect(screen.getByText('Past Trustee One')).toBeInTheDocument();
    });

    test('renders empty message when flag is on and history is empty', () => {
      mockUseFeatureFlags.mockReturnValue({
        [TRUSTEE_APPOINTMENT_HISTORY_ENABLED]: true,
      });
      const trustee = MockData.getTrustee();
      mockUseCaseAppointment.mockReturnValue({
        appointedDate: null,
        trusteeId: trustee.trusteeId,
        history: [],
        loading: false,
      });
      mockUseTrustee.mockReturnValue({ trustee, loading: false });

      renderPanel();

      expect(screen.getByTestId('past-trustees-empty')).toBeInTheDocument();
      expect(screen.getByText('No past trustees for this case.')).toBeInTheDocument();
    });

    test('does not render section when flag is off', () => {
      const trustee = MockData.getTrustee();
      const history = [
        {
          id: 'ca-past-1',
          caseId: '111-24-00001',
          trusteeId: 'trustee-past-1',
          trusteeName: 'Past Trustee One',
          assignedOn: '2025-01-01T00:00:00Z',
          appointedDate: '2025-04-01',
          unassignedOn: '2025-12-31T00:00:00Z',
          createdOn: '2025-01-01T00:00:00Z',
          createdBy: { id: 'system', name: 'System' },
          updatedOn: '2025-01-01T00:00:00Z',
          updatedBy: { id: 'system', name: 'System' },
        },
      ];
      mockUseCaseAppointment.mockReturnValue({
        appointedDate: null,
        trusteeId: trustee.trusteeId,
        history,
        loading: false,
      });
      mockUseTrustee.mockReturnValue({ trustee, loading: false });

      renderPanel();

      expect(screen.queryByTestId('past-trustees-section')).not.toBeInTheDocument();
    });

    test('renders past trustee name as link opening in new tab', () => {
      mockUseFeatureFlags.mockReturnValue({
        [TRUSTEE_APPOINTMENT_HISTORY_ENABLED]: true,
      });
      const trustee = MockData.getTrustee();
      const history = [
        {
          id: 'ca-past-1',
          caseId: '111-24-00001',
          trusteeId: 'trustee-past-1',
          trusteeName: 'Past Trustee One',
          assignedOn: '2025-01-01T00:00:00Z',
          appointedDate: '2025-04-01',
          unassignedOn: '2025-12-31T00:00:00Z',
          createdOn: '2025-01-01T00:00:00Z',
          createdBy: { id: 'system', name: 'System' },
          updatedOn: '2025-01-01T00:00:00Z',
          updatedBy: { id: 'system', name: 'System' },
        },
      ];
      mockUseCaseAppointment.mockReturnValue({
        appointedDate: null,
        trusteeId: trustee.trusteeId,
        history,
        loading: false,
      });
      mockUseTrustee.mockReturnValue({ trustee, loading: false });

      renderPanel();

      const link = screen.getByRole('link', { name: 'Past Trustee One' });
      expect(link).toHaveAttribute('href', '/trustees/trustee-past-1');
      expect(link).toHaveAttribute('target', '_blank');
    });

    test('does not render section when no current trustee', () => {
      mockUseFeatureFlags.mockReturnValue({
        [TRUSTEE_APPOINTMENT_HISTORY_ENABLED]: true,
      });
      const history = [
        {
          id: 'ca-past-1',
          caseId: '111-24-00001',
          trusteeId: 'trustee-past-1',
          trusteeName: 'Past Trustee One',
          assignedOn: '2025-01-01T00:00:00Z',
          appointedDate: '2025-04-01',
          unassignedOn: '2025-12-31T00:00:00Z',
          createdOn: '2025-01-01T00:00:00Z',
          createdBy: { id: 'system', name: 'System' },
          updatedOn: '2025-01-01T00:00:00Z',
          updatedBy: { id: 'system', name: 'System' },
        },
      ];
      mockUseCaseAppointment.mockReturnValue({
        appointedDate: null,
        trusteeId: null,
        history,
        loading: false,
      });
      mockUseTrustee.mockReturnValue({ trustee: null, loading: false });

      renderPanel();

      expect(screen.queryByTestId('past-trustees-section')).not.toBeInTheDocument();
    });
  });
});
