import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import ContactInformationCard from './ContactInformationCard';
import * as FormattedContactModule from '@/lib/components/cams/FormattedContact';
import { TrusteeContact } from '@common/cams/trustees';

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

  test('passes typedPhonesEnabled and showPhoneTypeLabel as true to FormattedContact', () => {
    const mockFormattedContact = vi
      .spyOn(FormattedContactModule, 'default')
      .mockReturnValue(<div data-testid="mock-formatted-contact" />);

    render(<ContactInformationCard internalContact={baseContact} />);

    expect(mockFormattedContact).toHaveBeenCalled();
    const props = mockFormattedContact.mock.calls.at(-1)![0];
    expect(props.contact).toEqual(baseContact);
    expect(props.typedPhonesEnabled).toBe(true);
    expect(props.showPhoneTypeLabel).toBe(true);
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
});
