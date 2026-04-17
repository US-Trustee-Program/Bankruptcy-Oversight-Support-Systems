import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
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

import { useTrustee } from './useTrustee';
import { useCaseAppointment } from './useCaseAppointment';

const mockTrackEvent = vi.fn();
vi.mock('@/lib/hooks/UseApplicationInsights', () => ({
  getAppInsights: () => ({
    appInsights: { trackEvent: mockTrackEvent },
  }),
}));

const mockUseTrustee = vi.mocked(useTrustee);
const mockUseCaseAppointment = vi.mocked(useCaseAppointment);

function renderPanel() {
  const caseDetail = MockData.getCaseDetail();
  render(
    <BrowserRouter>
      <CaseDetailTrusteePanel caseDetail={caseDetail} />
    </BrowserRouter>,
  );
}

describe('CaseDetailTrusteePanel', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.resetAllMocks();
    const user = MockData.getCamsUser({ roles: [CamsRole.TrusteeAdmin] });
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(MockData.getCamsSession({ user }));
    mockUseCaseAppointment.mockReturnValue({
      appointedDate: null,
      trusteeId: null,
      loading: false,
    });
    mockUseTrustee.mockReturnValue({ trustee: null, loading: false });
  });

  test('renders panel wrapper', () => {
    renderPanel();

    expect(screen.getByTestId('case-detail-trustee-panel')).toBeInTheDocument();
  });

  test('renders plain text message when no active appointment exists', () => {
    mockUseCaseAppointment.mockReturnValue({
      appointedDate: null,
      trusteeId: null,
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
      loading: false,
    });
    mockUseTrustee.mockReturnValue({ trustee: null, loading: false });

    renderPanel();

    expect(screen.getByTestId('case-detail-trustee-panel-no-info')).toBeInTheDocument();
    expect(screen.queryByTestId('case-trustee-card')).not.toBeInTheDocument();
  });

  test('renders trustee card when trustee is loaded', () => {
    const trustee = MockData.getTrustee();
    mockUseCaseAppointment.mockReturnValue({
      appointedDate: null,
      trusteeId: trustee.trusteeId,
      loading: false,
    });
    mockUseTrustee.mockReturnValue({ trustee, loading: false });

    renderPanel();

    expect(screen.getByTestId('case-trustee-card')).toBeInTheDocument();
  });

  test('renders trustee name as link to trustee profile', () => {
    const trustee = MockData.getTrustee();
    mockUseCaseAppointment.mockReturnValue({
      appointedDate: null,
      trusteeId: trustee.trusteeId,
      loading: false,
    });
    mockUseTrustee.mockReturnValue({ trustee, loading: false });

    renderPanel();

    const link = screen.getByTestId('case-detail-trustee-link');
    expect(link).toHaveAttribute('href', `/trustees/${trustee.trusteeId}`);
  });

  test('renders public address in trustee card', () => {
    const trustee = MockData.getTrustee();
    mockUseCaseAppointment.mockReturnValue({
      appointedDate: null,
      trusteeId: trustee.trusteeId,
      loading: false,
    });
    mockUseTrustee.mockReturnValue({ trustee, loading: false });

    renderPanel();

    expect(screen.getByTestId('case-trustee-public-street-address')).toBeInTheDocument();
  });

  test('renders heading with trustee name when trustee is loaded', () => {
    const trustee = MockData.getTrustee();
    mockUseCaseAppointment.mockReturnValue({
      appointedDate: null,
      trusteeId: trustee.trusteeId,
      loading: false,
    });
    mockUseTrustee.mockReturnValue({ trustee, loading: false });

    renderPanel();

    expect(screen.getByTestId('case-detail-trustee-panel-heading')).toHaveTextContent(
      `Trustee - ${trustee.name}`,
    );
  });

  test('renders internal contact card when trustee is loaded', () => {
    const trustee = MockData.getTrustee();
    mockUseCaseAppointment.mockReturnValue({
      appointedDate: null,
      trusteeId: trustee.trusteeId,
      loading: false,
    });
    mockUseTrustee.mockReturnValue({ trustee, loading: false });

    renderPanel();

    expect(screen.getByText('Internal use only.')).toBeInTheDocument();
  });

  test('renders both public and internal cards when trustee is loaded', () => {
    const trustee = MockData.getTrustee();
    mockUseCaseAppointment.mockReturnValue({
      appointedDate: null,
      trusteeId: trustee.trusteeId,
      loading: false,
    });
    mockUseTrustee.mockReturnValue({ trustee, loading: false });

    renderPanel();

    expect(screen.getByTestId('case-trustee-card')).toBeInTheDocument();
    expect(screen.getByText('Internal use only.')).toBeInTheDocument();
  });

  test('renders 341 meeting card when trustee is loaded', () => {
    const trustee = MockData.getTrustee();
    mockUseCaseAppointment.mockReturnValue({
      appointedDate: null,
      trusteeId: trustee.trusteeId,
      loading: false,
    });
    mockUseTrustee.mockReturnValue({ trustee, loading: false });

    renderPanel();

    expect(screen.getByTestId('zoom-info-card')).toBeInTheDocument();
  });

  test('renders 341 meeting empty state when trustee has no zoomInfo', () => {
    const trustee = MockData.getTrustee({ zoomInfo: undefined });
    mockUseCaseAppointment.mockReturnValue({
      appointedDate: null,
      trusteeId: trustee.trusteeId,
      loading: false,
    });
    mockUseTrustee.mockReturnValue({ trustee, loading: false });

    renderPanel();

    expect(screen.getByTestId('zoom-info-empty-message')).toBeInTheDocument();
  });

  test('renders 341 meeting content when trustee has zoomInfo', () => {
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
      loading: false,
    });
    mockUseTrustee.mockReturnValue({ trustee, loading: false });

    renderPanel();

    expect(screen.getByTestId('zoom-info-content')).toBeInTheDocument();
  });

  test('does not render edit button on 341 meeting card', () => {
    const trustee = MockData.getTrustee();
    mockUseCaseAppointment.mockReturnValue({
      appointedDate: null,
      trusteeId: trustee.trusteeId,
      loading: false,
    });
    mockUseTrustee.mockReturnValue({ trustee, loading: false });

    renderPanel();

    expect(
      screen.queryByRole('button', { name: 'Edit 341 meeting information' }),
    ).not.toBeInTheDocument();
  });

  test('renders appointed date when appointedDate is present', () => {
    const trustee = MockData.getTrustee();
    mockUseCaseAppointment.mockReturnValue({
      appointedDate: '2026-04-07',
      trusteeId: trustee.trusteeId,
      loading: false,
    });
    mockUseTrustee.mockReturnValue({ trustee, loading: false });

    renderPanel();

    expect(screen.getByTestId('case-detail-trustee-panel-appointed-date')).toHaveTextContent(
      'Appointed: 04/07/2026',
    );
  });

  test('fires "Trustee Info Viewed" telemetry event when trustee loads', () => {
    const trustee = MockData.getTrustee();
    mockUseCaseAppointment.mockReturnValue({
      appointedDate: null,
      trusteeId: trustee.trusteeId,
      loading: false,
    });
    mockUseTrustee.mockReturnValue({ trustee, loading: false });

    renderPanel();

    expect(mockTrackEvent).toHaveBeenCalledWith({ name: 'Trustee Info Viewed' });
  });

  test('does not fire "Trustee Info Viewed" telemetry when trustee is null', () => {
    mockUseCaseAppointment.mockReturnValue({
      appointedDate: null,
      trusteeId: null,
      loading: false,
    });
    mockUseTrustee.mockReturnValue({ trustee: null, loading: false });

    renderPanel();

    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  test('does not render appointed date when appointedDate is null', () => {
    const trustee = MockData.getTrustee();
    mockUseCaseAppointment.mockReturnValue({
      appointedDate: null,
      trusteeId: trustee.trusteeId,
      loading: false,
    });
    mockUseTrustee.mockReturnValue({ trustee, loading: false });

    renderPanel();

    expect(
      screen.queryByTestId('case-detail-trustee-panel-appointed-date'),
    ).not.toBeInTheDocument();
  });
});
