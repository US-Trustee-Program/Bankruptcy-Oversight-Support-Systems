import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import ContactInformationCard from './ContactInformationCard';
import * as FormattedContactModule from '@/lib/components/cams/FormattedContact';
import { TrusteeContact } from '@common/cams/trustees';
import * as featureFlagsHook from '@/lib/hooks/UseFeatureFlags';
import { TRUSTEE_TYPED_PHONES } from '@/lib/hooks/UseFeatureFlags';

const baseContact: TrusteeContact = {
  address: {
    address1: '123 Main St',
    city: 'Anytown',
    state: 'NY',
    zipCode: '10001',
    countryCode: 'US',
  },
  phones: [
    { number: '555-111-2222', type: 'direct' },
    { number: '555-333-4444', type: 'personalMobile' },
  ],
  email: 'jane@example.com',
};

describe('ContactInformationCard', () => {
  const mockOnEdit = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    mockOnEdit.mockClear();
    vi.spyOn(featureFlagsHook, 'default').mockReturnValue({ [TRUSTEE_TYPED_PHONES]: false });
  });

  test('always shows the "Internal use only." notice', () => {
    render(<ContactInformationCard internalContact={baseContact} />);

    expect(screen.getByText('Internal use only.')).toBeInTheDocument();
  });

  test('shows "No information added." when there is no internal contact', () => {
    render(<ContactInformationCard internalContact={undefined} />);

    expect(screen.getByTestId('no-internal-information')).toHaveTextContent(
      'No information added.',
    );
  });

  test('passes the internal contact through to FormattedContact with phones stripped out', () => {
    const mockFormattedContact = vi
      .spyOn(FormattedContactModule, 'default')
      .mockReturnValue(<div data-testid="mock-formatted-contact" />);

    render(<ContactInformationCard internalContact={baseContact} />);

    expect(mockFormattedContact).toHaveBeenCalled();
    const props = mockFormattedContact.mock.calls.at(-1)![0];
    expect(props.contact).toEqual({ ...baseContact, phones: undefined });
    expect(props.testIdPrefix).toBe('trustee-internal');
  });

  test('renders no edit button when onEdit is not provided', () => {
    render(<ContactInformationCard internalContact={baseContact} />);

    expect(
      screen.queryByRole('button', { name: 'Edit trustee internal contact information' }),
    ).not.toBeInTheDocument();
  });

  test('calls onEdit when the edit button is clicked', () => {
    render(<ContactInformationCard internalContact={baseContact} onEdit={mockOnEdit} />);

    screen.getByRole('button', { name: 'Edit trustee internal contact information' }).click();

    expect(mockOnEdit).toHaveBeenCalledTimes(1);
  });

  test('shows only the direct phone, with no type label, when the typed phones flag is disabled', () => {
    render(<ContactInformationCard internalContact={baseContact} />);

    expect(screen.getByText('555-111-2222')).toBeInTheDocument();
    expect(screen.queryByText('(Direct)')).not.toBeInTheDocument();
    expect(screen.queryByText('555-333-4444')).not.toBeInTheDocument();
  });

  test('shows every typed phone when the typed phones flag is enabled', () => {
    vi.spyOn(featureFlagsHook, 'default').mockReturnValue({ [TRUSTEE_TYPED_PHONES]: true });

    render(<ContactInformationCard internalContact={baseContact} />);

    expect(screen.getByText('555-111-2222')).toBeInTheDocument();
    expect(screen.getByText('555-333-4444')).toBeInTheDocument();
  });

  test('shows no phone when the flag is disabled and there is no direct-type phone', () => {
    const personalMobileOnlyContact: TrusteeContact = {
      ...baseContact,
      phones: [{ number: '555-333-4444', type: 'personalMobile' }],
    };

    render(<ContactInformationCard internalContact={personalMobileOnlyContact} />);

    expect(screen.queryByText('555-333-4444')).not.toBeInTheDocument();
  });
});
