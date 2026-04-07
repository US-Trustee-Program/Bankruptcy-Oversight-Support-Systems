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

  describe('contact sections', () => {
    test('renders public contact section when trustee is loaded', () => {
      const trustee = MockData.getTrustee();
      mockUseTrustee.mockReturnValue({ trustee, loading: false });

      renderCard(trustee.trusteeId);

      expect(screen.getByTestId('case-trustee-public-contact')).toBeInTheDocument();
    });

    test('renders public address via FormattedContact', () => {
      const trustee = MockData.getTrustee();
      mockUseTrustee.mockReturnValue({ trustee, loading: false });

      renderCard(trustee.trusteeId);

      expect(screen.getByTestId('case-trustee-public-street-address')).toBeInTheDocument();
    });

    test('renders public phone number', () => {
      const trustee = MockData.getTrustee({
        public: MockData.getContactInformation({ phone: { number: '555-123-4567' } }),
      });
      mockUseTrustee.mockReturnValue({ trustee, loading: false });

      renderCard(trustee.trusteeId);

      expect(screen.getByTestId('case-trustee-public-phone-number')).toBeInTheDocument();
    });

    test('renders public email', () => {
      const trustee = MockData.getTrustee({
        public: MockData.getContactInformation({ email: 'test@example.com' }),
      });
      mockUseTrustee.mockReturnValue({ trustee, loading: false });

      renderCard(trustee.trusteeId);

      expect(screen.getByTestId('case-trustee-public-email')).toBeInTheDocument();
    });

    test('renders internal contact section when trustee is loaded', () => {
      const trustee = MockData.getTrustee();
      mockUseTrustee.mockReturnValue({ trustee, loading: false });

      renderCard(trustee.trusteeId);

      expect(screen.getByTestId('case-trustee-internal-contact')).toBeInTheDocument();
    });

    test('renders "Internal use only." alert in internal section', () => {
      const trustee = MockData.getTrustee();
      mockUseTrustee.mockReturnValue({ trustee, loading: false });

      renderCard(trustee.trusteeId);

      expect(screen.getByText('Internal use only.')).toBeInTheDocument();
    });

    test('renders internal contact fields when trustee.internal is present', () => {
      const trustee = MockData.getTrustee({
        internal: MockData.getContactInformation(),
      });
      mockUseTrustee.mockReturnValue({ trustee, loading: false });

      renderCard(trustee.trusteeId);

      expect(screen.getByTestId('case-trustee-internal-street-address')).toBeInTheDocument();
    });

    test('renders internal empty state when trustee.internal is absent', () => {
      const trustee = MockData.getTrustee();
      // getTrustee() does not include internal by default
      trustee.internal = undefined;
      mockUseTrustee.mockReturnValue({ trustee, loading: false });

      renderCard(trustee.trusteeId);

      expect(screen.getByTestId('case-trustee-internal-contact-empty')).toBeInTheDocument();
      expect(screen.getByText('No internal contact information.')).toBeInTheDocument();
    });

    test('does not render contact sections when trusteeId is undefined', () => {
      mockUseTrustee.mockReturnValue({ trustee: null, loading: false });

      renderCard(undefined);

      expect(screen.queryByTestId('case-trustee-public-contact')).not.toBeInTheDocument();
      expect(screen.queryByTestId('case-trustee-internal-contact')).not.toBeInTheDocument();
    });

    test('does not render contact sections while loading', () => {
      mockUseTrustee.mockReturnValue({ trustee: null, loading: true });

      renderCard('trustee-123');

      expect(screen.queryByTestId('case-trustee-public-contact')).not.toBeInTheDocument();
      expect(screen.queryByTestId('case-trustee-internal-contact')).not.toBeInTheDocument();
    });
  });
});
