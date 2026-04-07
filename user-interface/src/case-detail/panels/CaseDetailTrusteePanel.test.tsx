import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import CaseDetailTrusteePanel from './CaseDetailTrusteePanel';
import MockData from '@common/cams/test-utilities/mock-data';
import { ZoomInfo } from '@common/cams/trustees';

vi.mock('./useTrustee', () => ({
  useTrustee: vi.fn(),
}));

vi.mock('./useCaseAppointment', () => ({
  useCaseAppointment: vi.fn(),
}));

import { useTrustee } from './useTrustee';
import { useCaseAppointment } from './useCaseAppointment';

const mockUseTrustee = vi.mocked(useTrustee);
const mockUseCaseAppointment = vi.mocked(useCaseAppointment);

function renderPanel(trusteeId?: string) {
  const caseDetail = MockData.getCaseDetail({ override: { trusteeId } });
  render(
    <BrowserRouter>
      <CaseDetailTrusteePanel caseDetail={caseDetail} />
    </BrowserRouter>,
  );
}

describe('CaseDetailTrusteePanel', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockUseCaseAppointment.mockReturnValue({ appointedDate: null, loading: false });
  });

  test('renders panel wrapper', () => {
    mockUseTrustee.mockReturnValue({ trustee: null, loading: false });

    renderPanel('trustee-001');

    expect(screen.getByTestId('case-detail-trustee-panel')).toBeInTheDocument();
  });

  test('renders plain text message when trusteeId is absent', () => {
    mockUseTrustee.mockReturnValue({ trustee: null, loading: false });

    renderPanel(undefined);

    expect(screen.getByTestId('case-detail-trustee-panel-empty')).toBeInTheDocument();
    expect(screen.getByText('No Trustee has been appointed for this case.')).toBeInTheDocument();
    expect(screen.queryByTestId('case-trustee-card')).not.toBeInTheDocument();
  });

  test('renders loading state while fetching', () => {
    mockUseTrustee.mockReturnValue({ trustee: null, loading: true });

    renderPanel('trustee-001');

    expect(screen.getByTestId('case-detail-trustee-panel-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('case-trustee-card')).not.toBeInTheDocument();
  });

  test('renders no-info state when trustee fetch returns null', () => {
    mockUseTrustee.mockReturnValue({ trustee: null, loading: false });

    renderPanel('trustee-001');

    expect(screen.getByTestId('case-detail-trustee-panel-no-info')).toBeInTheDocument();
    expect(screen.queryByTestId('case-trustee-card')).not.toBeInTheDocument();
  });

  test('renders CaseTrusteeCard when trustee is loaded', () => {
    const trustee = MockData.getTrustee();
    mockUseTrustee.mockReturnValue({ trustee, loading: false });

    renderPanel(trustee.trusteeId);

    expect(screen.getByTestId('case-trustee-card')).toBeInTheDocument();
  });

  test('renders heading with trustee name when trustee is loaded', () => {
    const trustee = MockData.getTrustee();
    mockUseTrustee.mockReturnValue({ trustee, loading: false });

    renderPanel(trustee.trusteeId);

    expect(screen.getByTestId('case-detail-trustee-panel-heading')).toHaveTextContent(
      `Trustee - ${trustee.name}`,
    );
  });

  test('renders internal contact card when trustee is loaded', () => {
    const trustee = MockData.getTrustee();
    mockUseTrustee.mockReturnValue({ trustee, loading: false });

    renderPanel(trustee.trusteeId);

    expect(screen.getByText('Internal use only.')).toBeInTheDocument();
  });

  test('renders both public and internal cards when trustee is loaded', () => {
    const trustee = MockData.getTrustee();
    mockUseTrustee.mockReturnValue({ trustee, loading: false });

    renderPanel(trustee.trusteeId);

    expect(screen.getByTestId('case-trustee-card')).toBeInTheDocument();
    expect(screen.getByText('Internal use only.')).toBeInTheDocument();
  });

  test('renders 341 meeting card when trustee is loaded', () => {
    const trustee = MockData.getTrustee();
    mockUseTrustee.mockReturnValue({ trustee, loading: false });

    renderPanel(trustee.trusteeId);

    expect(screen.getByTestId('zoom-info-card')).toBeInTheDocument();
  });

  test('renders 341 meeting empty state when trustee has no zoomInfo', () => {
    const trustee = MockData.getTrustee({ zoomInfo: undefined });
    mockUseTrustee.mockReturnValue({ trustee, loading: false });

    renderPanel(trustee.trusteeId);

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
    mockUseTrustee.mockReturnValue({ trustee, loading: false });

    renderPanel(trustee.trusteeId);

    expect(screen.getByTestId('zoom-info-content')).toBeInTheDocument();
  });

  test('does not render edit button on 341 meeting card', () => {
    const trustee = MockData.getTrustee();
    mockUseTrustee.mockReturnValue({ trustee, loading: false });

    renderPanel(trustee.trusteeId);

    expect(
      screen.queryByRole('button', { name: 'Edit 341 meeting information' }),
    ).not.toBeInTheDocument();
  });

  test('renders appointed date when appointedDate is present', () => {
    const trustee = MockData.getTrustee();
    mockUseTrustee.mockReturnValue({ trustee, loading: false });
    mockUseCaseAppointment.mockReturnValue({ appointedDate: '2026-04-07', loading: false });

    renderPanel(trustee.trusteeId);

    expect(screen.getByTestId('case-detail-trustee-panel-appointed-date')).toHaveTextContent(
      'Appointed: April 7, 2026',
    );
  });

  test('does not render appointed date when appointedDate is null', () => {
    const trustee = MockData.getTrustee();
    mockUseTrustee.mockReturnValue({ trustee, loading: false });
    mockUseCaseAppointment.mockReturnValue({ appointedDate: null, loading: false });

    renderPanel(trustee.trusteeId);

    expect(
      screen.queryByTestId('case-detail-trustee-panel-appointed-date'),
    ).not.toBeInTheDocument();
  });
});
