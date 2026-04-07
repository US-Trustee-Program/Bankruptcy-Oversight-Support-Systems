import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import CaseDetailTrusteePanel from './CaseDetailTrusteePanel';
import MockData from '@common/cams/test-utilities/mock-data';

vi.mock('./useTrustee', () => ({
  useTrustee: vi.fn(),
}));

import { useTrustee } from './useTrustee';

const mockUseTrustee = vi.mocked(useTrustee);

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
});
