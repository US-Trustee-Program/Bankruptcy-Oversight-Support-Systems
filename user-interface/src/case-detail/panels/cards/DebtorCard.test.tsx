import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import DebtorCard from './DebtorCard';
import { Debtor, DebtorAttorney } from '@common/cams/parties';
import * as CommsLinkModule from '@/lib/components/cams/CommsLink/CommsLink';
import { ContactInformation } from '@common/cams/contact';

beforeEach(() => {
  vi.spyOn(CommsLinkModule, 'default').mockImplementation(
    ({ contact, mode }: { contact: Omit<ContactInformation, 'address'>; mode: string }) => (
      <span data-testid={`comms-link-${mode}`}>{contact.phone?.number || contact.email}</span>
    ),
  );
});

describe('DebtorCard', () => {
  const mockDebtor: Debtor = {
    name: 'John Doe',
    ssn: '123-45-6789',
    address1: '123 Main St',
    cityStateZipCountry: 'New York, NY 10001',
    phone: '555-123-4567',
    email: 'john@example.com',
  };

  const mockAttorney: DebtorAttorney = {
    name: 'Jane Attorney',
    office: 'Law Office LLC',
    address1: '456 Legal Ave',
    cityStateZipCountry: 'New York, NY 10002',
    phone: '555-987-6543',
    email: 'jane@lawoffice.com',
  };

  const defaultProps = {
    title: 'Debtor - John Doe',
    debtor: mockDebtor,
    debtorTypeLabel: 'Individual',
    attorney: mockAttorney,
    caseId: '12-34567',
    caseTitle: 'John Doe',
    testIdPrefix: 'test-debtor',
  };

  test('renders debtor card with title', () => {
    render(<DebtorCard {...defaultProps} />);

    expect(screen.getByText('Debtor - John Doe')).toBeInTheDocument();
    expect(screen.getByText('Debtor Information')).toBeInTheDocument();
  });

  test('displays SSN when provided', () => {
    render(<DebtorCard {...defaultProps} />);

    expect(screen.getByTestId('test-debtor-ssn')).toBeInTheDocument();
    expect(screen.getByText('SSN:')).toBeInTheDocument();
    expect(screen.getByText('123-45-6789')).toBeInTheDocument();
  });

  test('displays EIN when provided instead of SSN', () => {
    const debtorWithEIN: Debtor = {
      ...mockDebtor,
      ssn: undefined,
      taxId: '12-3456789',
    };

    render(<DebtorCard {...defaultProps} debtor={debtorWithEIN} />);

    expect(screen.getByTestId('test-debtor-taxId')).toBeInTheDocument();
    expect(screen.getByText('EIN:')).toBeInTheDocument();
    expect(screen.getByText('12-3456789')).toBeInTheDocument();
  });

  test('shows tax ID unavailable message when no SSN or EIN', () => {
    const debtorWithoutTaxId: Debtor = {
      ...mockDebtor,
      ssn: undefined,
    };

    render(<DebtorCard {...defaultProps} debtor={debtorWithoutTaxId} />);

    expect(screen.getByTestId('test-debtor-no-taxids')).toBeInTheDocument();
    expect(screen.getByText('Tax ID information is not available.')).toBeInTheDocument();
  });

  test('displays debtor type when provided', () => {
    render(<DebtorCard {...defaultProps} />);

    expect(screen.getByTestId('test-debtor-type')).toBeInTheDocument();
    expect(screen.getByText('Individual')).toBeInTheDocument();
  });

  test('displays debtor address', () => {
    render(<DebtorCard {...defaultProps} />);

    expect(screen.getByTestId('test-debtor-address1')).toBeInTheDocument();
    expect(screen.getByText('123 Main St')).toBeInTheDocument();
    expect(screen.getByTestId('test-debtor-city-state-zip')).toBeInTheDocument();
  });

  test('displays debtor phone as link', () => {
    render(<DebtorCard {...defaultProps} />);

    expect(screen.getByTestId('test-debtor-phone-number')).toBeInTheDocument();
    expect(screen.getAllByTestId('comms-link-phone-dialer').length).toBeGreaterThan(0);
  });

  test('displays debtor email as link', () => {
    render(<DebtorCard {...defaultProps} />);

    expect(screen.getByTestId('test-debtor-email')).toBeInTheDocument();
    expect(screen.getAllByTestId('comms-link-email').length).toBeGreaterThan(0);
  });

  test('displays attorney information when provided', () => {
    render(<DebtorCard {...defaultProps} />);

    expect(screen.getByText('Counsel')).toBeInTheDocument();
    expect(screen.getByTestId('test-debtor-counsel-name')).toBeInTheDocument();
    expect(screen.getByText('Jane Attorney')).toBeInTheDocument();
    expect(screen.getByTestId('test-debtor-counsel-office')).toBeInTheDocument();
    expect(screen.getByText('Law Office LLC')).toBeInTheDocument();
  });

  test('displays attorney address', () => {
    render(<DebtorCard {...defaultProps} />);

    expect(screen.getByTestId('test-debtor-counsel-address1')).toBeInTheDocument();
    expect(screen.getByText('456 Legal Ave')).toBeInTheDocument();
  });

  test('displays attorney phone as link', () => {
    render(<DebtorCard {...defaultProps} />);

    expect(screen.getByTestId('test-debtor-counsel-phone-number')).toBeInTheDocument();
  });

  test('displays attorney email as link', () => {
    render(<DebtorCard {...defaultProps} />);

    expect(screen.getByTestId('test-debtor-counsel-email')).toBeInTheDocument();
  });

  test('shows information unavailable when no attorney', () => {
    render(<DebtorCard {...defaultProps} attorney={undefined} />);

    expect(screen.getByTestId('test-debtor-no-attorney')).toBeInTheDocument();
    expect(screen.getByText('Information is not available.')).toBeInTheDocument();
  });

  test('uses semantic HTML with dl, dt, dd elements for tax ID', () => {
    const { container } = render(<DebtorCard {...defaultProps} />);

    const dl = container.querySelector('.info-group dl');
    expect(dl).toBeInTheDocument();

    const dt = container.querySelector('dt');
    expect(dt).toBeInTheDocument();
    expect(dt).toHaveClass('case-detail-item-name');

    const dd = container.querySelector('dd');
    expect(dd).toBeInTheDocument();
    expect(dd).toHaveClass('case-detail-item-value');
  });

  test('groups information with proper spacing classes', () => {
    const { container } = render(<DebtorCard {...defaultProps} />);

    const infoGroups = container.querySelectorAll('.info-group');
    expect(infoGroups.length).toBeGreaterThan(0);
  });

  test('renders two-column grid layout', () => {
    const { container } = render(<DebtorCard {...defaultProps} />);

    const grid = container.querySelector('.debtor-info-grid');
    expect(grid).toBeInTheDocument();

    const debtorCard = container.querySelector('.debtor-info-card');
    expect(debtorCard).toBeInTheDocument();

    const counselCard = container.querySelector('.debtor-counsel-card');
    expect(counselCard).toBeInTheDocument();
  });

  describe('Alias names', () => {
    test('renders primary name without additionalIdentifiers when additionalIdentifiers not provided', () => {
      render(<DebtorCard {...defaultProps} />);

      expect(screen.getByTestId('test-debtor-name')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.queryByText(/^Alias:/)).not.toBeInTheDocument();
    });

    test('renders primary name with multiple additionalIdentifiers', () => {
      const debtorWithAliases: Debtor = {
        ...mockDebtor,
        additionalIdentifiers: {
          names: ['John Smith', 'J. Doe', 'Johnny Doe'],
        },
      };

      render(<DebtorCard {...defaultProps} debtor={debtorWithAliases} />);

      expect(screen.getByTestId('test-debtor-name')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByTestId('test-debtor-alias-name-0')).toBeInTheDocument();
      expect(screen.getByTestId('test-debtor-alias-name-0')).toHaveTextContent('Alias: John Smith');
      expect(screen.getByTestId('test-debtor-alias-name-1')).toBeInTheDocument();
      expect(screen.getByTestId('test-debtor-alias-name-1')).toHaveTextContent('Alias: J. Doe');
      expect(screen.getByTestId('test-debtor-alias-name-2')).toBeInTheDocument();
      expect(screen.getByTestId('test-debtor-alias-name-2')).toHaveTextContent('Alias: Johnny Doe');
    });

    test('each alias has "Alias:" prefix', () => {
      const debtorWithAliases: Debtor = {
        ...mockDebtor,
        additionalIdentifiers: {
          names: ['John Smith', 'J. Doe'],
        },
      };

      render(<DebtorCard {...defaultProps} debtor={debtorWithAliases} />);

      expect(screen.getByTestId('test-debtor-alias-name-0')).toHaveTextContent('Alias: John Smith');
      expect(screen.getByTestId('test-debtor-alias-name-1')).toHaveTextContent('Alias: J. Doe');
    });

    test('each alias has unique test ID', () => {
      const debtorWithAliases: Debtor = {
        ...mockDebtor,
        additionalIdentifiers: {
          names: ['John Smith', 'J. Doe', 'Johnny Doe'],
        },
      };

      render(<DebtorCard {...defaultProps} debtor={debtorWithAliases} />);

      expect(screen.getByTestId('test-debtor-alias-name-0')).toBeInTheDocument();
      expect(screen.getByTestId('test-debtor-alias-name-1')).toBeInTheDocument();
      expect(screen.getByTestId('test-debtor-alias-name-2')).toBeInTheDocument();
    });

    test('does not render additionalIdentifiers section when additionalIdentifiers undefined', () => {
      const debtorWithoutAliases: Debtor = {
        ...mockDebtor,
        additionalIdentifiers: undefined,
      };

      render(<DebtorCard {...defaultProps} debtor={debtorWithoutAliases} />);

      expect(screen.getByTestId('test-debtor-name')).toBeInTheDocument();
      expect(screen.queryByText(/^Alias:/)).not.toBeInTheDocument();
    });

    test('does not render additionalIdentifiers section when additionalIdentifiers.names is empty array', () => {
      const debtorWithEmptyAliases: Debtor = {
        ...mockDebtor,
        additionalIdentifiers: {
          names: [],
        },
      };

      render(<DebtorCard {...defaultProps} debtor={debtorWithEmptyAliases} />);

      expect(screen.getByTestId('test-debtor-name')).toBeInTheDocument();
      expect(screen.queryByText(/^Alias:/)).not.toBeInTheDocument();
    });

    test('does not render additionalIdentifiers section when additionalIdentifiers.names is undefined', () => {
      const debtorWithUndefinedNames: Debtor = {
        ...mockDebtor,
        additionalIdentifiers: {},
      };

      render(<DebtorCard {...defaultProps} debtor={debtorWithUndefinedNames} />);

      expect(screen.getByTestId('test-debtor-name')).toBeInTheDocument();
      expect(screen.queryByText(/^Alias:/)).not.toBeInTheDocument();
    });
  });

  describe('Alias SSNs and Tax IDs', () => {
    test('renders multiple alias SSNs', () => {
      const debtorWithAliasSSNs: Debtor = {
        ...mockDebtor,
        ssn: '111-11-1111',
        additionalIdentifiers: {
          ssns: ['222-22-2222', '333-33-3333'],
        },
      };

      render(<DebtorCard {...defaultProps} debtor={debtorWithAliasSSNs} />);

      expect(screen.getByTestId('test-debtor-ssn')).toBeInTheDocument();
      expect(screen.getByText('111-11-1111')).toBeInTheDocument();
      expect(screen.getByTestId('test-debtor-alias-ssn-0')).toBeInTheDocument();
      expect(screen.getByText('222-22-2222')).toBeInTheDocument();
      expect(screen.getByTestId('test-debtor-alias-ssn-1')).toBeInTheDocument();
      expect(screen.getByText('333-33-3333')).toBeInTheDocument();
    });

    test('renders multiple alias tax IDs', () => {
      const debtorWithAliasTaxIds: Debtor = {
        ...mockDebtor,
        taxId: '12-3456789',
        ssn: undefined,
        additionalIdentifiers: {
          taxIds: ['98-7654321', '11-1111111'],
        },
      };

      render(<DebtorCard {...defaultProps} debtor={debtorWithAliasTaxIds} />);

      expect(screen.getByTestId('test-debtor-taxId')).toBeInTheDocument();
      expect(screen.getByText('12-3456789')).toBeInTheDocument();
      expect(screen.getByTestId('test-debtor-alias-taxId-0')).toBeInTheDocument();
      expect(screen.getByText('98-7654321')).toBeInTheDocument();
      expect(screen.getByTestId('test-debtor-alias-taxId-1')).toBeInTheDocument();
      expect(screen.getByText('11-1111111')).toBeInTheDocument();
    });

    test('renders all three types of additionalIdentifiers together', () => {
      const debtorWithAllAliases: Debtor = {
        ...mockDebtor,
        ssn: '111-11-1111',
        taxId: '12-3456789',
        additionalIdentifiers: {
          names: ['John Smith'],
          ssns: ['222-22-2222'],
          taxIds: ['98-7654321'],
        },
      };

      render(<DebtorCard {...defaultProps} debtor={debtorWithAllAliases} />);

      expect(screen.getByTestId('test-debtor-alias-name-0')).toHaveTextContent('Alias: John Smith');
      expect(screen.getByText('111-11-1111')).toBeInTheDocument();
      expect(screen.getByText('222-22-2222')).toBeInTheDocument();
      expect(screen.getByText('12-3456789')).toBeInTheDocument();
      expect(screen.getByText('98-7654321')).toBeInTheDocument();
    });

    test('each alias SSN has unique test ID', () => {
      const debtorWithAliasSSNs: Debtor = {
        ...mockDebtor,
        ssn: '111-11-1111',
        additionalIdentifiers: {
          ssns: ['222-22-2222', '333-33-3333', '444-44-4444'],
        },
      };

      render(<DebtorCard {...defaultProps} debtor={debtorWithAliasSSNs} />);

      expect(screen.getByTestId('test-debtor-alias-ssn-0')).toBeInTheDocument();
      expect(screen.getByTestId('test-debtor-alias-ssn-1')).toBeInTheDocument();
      expect(screen.getByTestId('test-debtor-alias-ssn-2')).toBeInTheDocument();
    });

    test('each alias tax ID has unique test ID', () => {
      const debtorWithAliasTaxIds: Debtor = {
        ...mockDebtor,
        ssn: undefined,
        taxId: '12-3456789',
        additionalIdentifiers: {
          taxIds: ['98-7654321', '11-1111111'],
        },
      };

      render(<DebtorCard {...defaultProps} debtor={debtorWithAliasTaxIds} />);

      expect(screen.getByTestId('test-debtor-alias-taxId-0')).toBeInTheDocument();
      expect(screen.getByTestId('test-debtor-alias-taxId-1')).toBeInTheDocument();
    });

    test('does not render alias SSNs section when empty', () => {
      const debtorWithEmptyAliases: Debtor = {
        ...mockDebtor,
        ssn: '111-11-1111',
        additionalIdentifiers: {
          ssns: [],
        },
      };

      render(<DebtorCard {...defaultProps} debtor={debtorWithEmptyAliases} />);

      expect(screen.getByTestId('test-debtor-ssn')).toBeInTheDocument();
      expect(screen.queryByTestId('test-debtor-alias-ssn-0')).not.toBeInTheDocument();
    });

    test('does not render alias tax IDs section when empty', () => {
      const debtorWithEmptyAliases: Debtor = {
        ...mockDebtor,
        ssn: undefined,
        taxId: '12-3456789',
        additionalIdentifiers: {
          taxIds: [],
        },
      };

      render(<DebtorCard {...defaultProps} debtor={debtorWithEmptyAliases} />);

      expect(screen.getByTestId('test-debtor-taxId')).toBeInTheDocument();
      expect(screen.queryByTestId('test-debtor-alias-taxId-0')).not.toBeInTheDocument();
    });
  });
});
