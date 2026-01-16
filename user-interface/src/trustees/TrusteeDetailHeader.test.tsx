import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import TrusteeDetailHeader, { TrusteeDetailHeaderProps } from './TrusteeDetailHeader';
import { Trustee } from '@common/cams/trustees';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';

const mockTrustee: Trustee = {
  id: '--id-guid--',
  trusteeId: '123',
  name: 'John Doe',
  public: {
    address: {
      address1: '123 Main St',
      address2: 'c/o John Smith',
      address3: 'Ch 7',
      city: 'Anytown',
      state: 'NY',
      zipCode: '12345',
      countryCode: 'US',
    },
    phone: { number: '555-123-4567', extension: '1234' },
    email: 'john.doe.public@example.com',
  },
  assistant: null,
  updatedBy: SYSTEM_USER_REFERENCE,
  updatedOn: '2024-01-01T00:00:00Z',
};

function renderWithProps(props?: Partial<TrusteeDetailHeaderProps>) {
  const defaultProps: TrusteeDetailHeaderProps = {
    trustee: mockTrustee,
    isLoading: false,
  };

  const renderProps = { ...defaultProps, ...props };
  render(<TrusteeDetailHeader {...renderProps} />);
}

describe('TrusteeDetailHeader', () => {
  test('should render loading state when isLoading is true', () => {
    renderWithProps({ isLoading: true });

    expect(screen.getByText('Trustee Details')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
  });

  test('should render loading state when trustee is null', () => {
    renderWithProps({ trustee: null });

    expect(screen.getByText('Trustee Details')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  test('should render trustee header with name when loaded', () => {
    renderWithProps({ subHeading: 'Trustee' });

    expect(screen.getByRole('heading', { level: 1, name: 'John Doe' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Trustee' })).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
