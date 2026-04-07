import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, test, expect, vi } from 'vitest';
import CaseDetailTrusteePanel from './CaseDetailTrusteePanel';
import MockData from '@common/cams/test-utilities/mock-data';

vi.mock('./useTrustee', () => ({
  useTrustee: vi.fn().mockReturnValue({ trustee: null, loading: false }),
}));

function renderPanel(trusteeId?: string) {
  const caseDetail = MockData.getCaseDetail({ override: { trusteeId } });
  render(
    <BrowserRouter>
      <CaseDetailTrusteePanel caseDetail={caseDetail} />
    </BrowserRouter>,
  );
}

describe('CaseDetailTrusteePanel', () => {
  test('renders panel wrapper', () => {
    renderPanel('trustee-001');

    expect(screen.getByTestId('case-detail-trustee-panel')).toBeInTheDocument();
  });

  test('renders CaseTrusteeCard when trusteeId is present', () => {
    renderPanel('trustee-001');

    expect(screen.getByTestId('case-trustee-card')).toBeInTheDocument();
  });

  test('renders CaseTrusteeCard empty state when trusteeId is absent', () => {
    renderPanel(undefined);

    expect(screen.getByTestId('case-trustee-card')).toBeInTheDocument();
    expect(screen.getByTestId('case-trustee-card-empty')).toBeInTheDocument();
  });
});
