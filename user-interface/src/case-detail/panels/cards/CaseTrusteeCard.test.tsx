import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, test, expect } from 'vitest';
import CaseTrusteeCard from './CaseTrusteeCard';
import MockData from '@common/cams/test-utilities/mock-data';
import { Trustee } from '@common/cams/trustees';

function renderCard(trustee: Trustee, trusteeId: string) {
  render(
    <BrowserRouter>
      <CaseTrusteeCard trustee={trustee} trusteeId={trusteeId} />
    </BrowserRouter>,
  );
}

describe('CaseTrusteeCard', () => {
  test('renders card wrapper', () => {
    const trustee = MockData.getTrustee();

    renderCard(trustee, trustee.trusteeId);

    expect(screen.getByTestId('case-trustee-card')).toBeInTheDocument();
  });

  test('renders trustee name', () => {
    const trustee = MockData.getTrustee();

    renderCard(trustee, trustee.trusteeId);

    expect(screen.getByTestId('case-trustee-card-name')).toBeInTheDocument();
    expect(screen.getByText(trustee.name)).toBeInTheDocument();
  });

  test('renders trustee name as link to profile', () => {
    const trustee = MockData.getTrustee();

    renderCard(trustee, trustee.trusteeId);

    const link = screen.getByTestId('case-detail-trustee-link');
    expect(link).toHaveAttribute('href', `/trustees/${trustee.trusteeId}`);
  });

  test('renders public contact section', () => {
    const trustee = MockData.getTrustee();

    renderCard(trustee, trustee.trusteeId);

    expect(screen.getByTestId('case-trustee-public-contact')).toBeInTheDocument();
  });

  test('renders public address', () => {
    const trustee = MockData.getTrustee();

    renderCard(trustee, trustee.trusteeId);

    expect(screen.getByTestId('case-trustee-public-street-address')).toBeInTheDocument();
  });

  test('does not render internal contact section', () => {
    const trustee = MockData.getTrustee();

    renderCard(trustee, trustee.trusteeId);

    expect(screen.queryByTestId('case-trustee-internal-contact')).not.toBeInTheDocument();
    expect(screen.queryByTestId('case-trustee-internal-card')).not.toBeInTheDocument();
  });

  test('does not render loading or empty state elements', () => {
    const trustee = MockData.getTrustee();

    renderCard(trustee, trustee.trusteeId);

    expect(screen.queryByTestId('case-trustee-card-loading')).not.toBeInTheDocument();
    expect(screen.queryByTestId('case-trustee-card-empty')).not.toBeInTheDocument();
  });
});
