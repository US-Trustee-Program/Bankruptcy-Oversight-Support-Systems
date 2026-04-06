import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import CaseTrusteeCard from './CaseTrusteeCard';
import MockData from '@common/cams/test-utilities/mock-data';

vi.mock('../useTrustee', () => ({
  useTrustee: vi.fn(),
}));

import { useTrustee } from '../useTrustee';

const mockUseTrustee = vi.mocked(useTrustee);

function renderCard(trusteeId?: string) {
  render(
    <BrowserRouter>
      <CaseTrusteeCard trusteeId={trusteeId} />
    </BrowserRouter>,
  );
}

describe('CaseTrusteeCard', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('renders empty state when trusteeId is undefined', () => {
    mockUseTrustee.mockReturnValue({ trustee: null, loading: false });

    renderCard(undefined);

    expect(screen.getByTestId('case-trustee-card')).toBeInTheDocument();
    expect(screen.getByTestId('case-trustee-card-empty')).toBeInTheDocument();
    expect(screen.getByText('No trustee appointed.')).toBeInTheDocument();
  });

  test('renders loading state while fetching trustee', () => {
    mockUseTrustee.mockReturnValue({ trustee: null, loading: true });

    renderCard('trustee-123');

    expect(screen.getByTestId('case-trustee-card-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('case-trustee-card-name')).not.toBeInTheDocument();
  });

  test('renders trustee name with link when trustee is loaded', () => {
    const trustee = MockData.getTrustee();
    mockUseTrustee.mockReturnValue({ trustee, loading: false });

    renderCard(trustee.trusteeId);

    expect(screen.getByTestId('case-trustee-card-name')).toBeInTheDocument();
    expect(screen.getByTestId('case-detail-trustee-link')).toBeInTheDocument();
    expect(screen.getByText(trustee.name)).toBeInTheDocument();
  });

  test('trustee name link points to correct profile URL', () => {
    const trustee = MockData.getTrustee();
    mockUseTrustee.mockReturnValue({ trustee, loading: false });

    renderCard(trustee.trusteeId);

    const link = screen.getByTestId('case-detail-trustee-link');
    expect(link).toHaveAttribute('href', `/trustees/${trustee.trusteeId}`);
  });

  test('renders empty state when trusteeId is present but trustee fetch fails', () => {
    mockUseTrustee.mockReturnValue({ trustee: null, loading: false });

    renderCard('trustee-123');

    expect(screen.getByTestId('case-trustee-card-empty')).toBeInTheDocument();
    expect(screen.getByText('No trustee information available.')).toBeInTheDocument();
  });
});
