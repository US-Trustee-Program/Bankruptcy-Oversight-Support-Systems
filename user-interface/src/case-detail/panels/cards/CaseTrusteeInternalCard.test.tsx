import { render, screen } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import MockData from '@common/cams/test-utilities/mock-data';
import CaseTrusteeInternalCard from './CaseTrusteeInternalCard';

describe('CaseTrusteeInternalCard', () => {
  test('renders card wrapper', () => {
    render(<CaseTrusteeInternalCard />);

    expect(screen.getByTestId('case-trustee-internal-card')).toBeInTheDocument();
  });

  test('renders "Internal use only." alert', () => {
    render(<CaseTrusteeInternalCard />);

    expect(screen.getByText('Internal use only.')).toBeInTheDocument();
  });

  test('renders empty state when internalContact is undefined', () => {
    render(<CaseTrusteeInternalCard />);

    expect(screen.getByTestId('case-trustee-internal-card-empty')).toBeInTheDocument();
    expect(screen.getByText('No internal contact information.')).toBeInTheDocument();
  });

  test('renders internal address when internalContact is present', () => {
    const internalContact = MockData.getContactInformation();

    render(<CaseTrusteeInternalCard internalContact={internalContact} />);

    expect(screen.getByTestId('case-trustee-internal-street-address')).toBeInTheDocument();
  });

  test('renders internal phone number when present', () => {
    const internalContact = MockData.getContactInformation({ phone: { number: '555-999-0000' } });

    render(<CaseTrusteeInternalCard internalContact={internalContact} />);

    expect(screen.getByTestId('case-trustee-internal-phone-number')).toBeInTheDocument();
  });

  test('renders internal email when present', () => {
    const internalContact = MockData.getContactInformation({ email: 'internal@example.gov' });

    render(<CaseTrusteeInternalCard internalContact={internalContact} />);

    expect(screen.getByTestId('case-trustee-internal-email')).toBeInTheDocument();
  });

  test('does not render empty state when internalContact is present', () => {
    const internalContact = MockData.getContactInformation();

    render(<CaseTrusteeInternalCard internalContact={internalContact} />);

    expect(screen.queryByTestId('case-trustee-internal-card-empty')).not.toBeInTheDocument();
  });
});
