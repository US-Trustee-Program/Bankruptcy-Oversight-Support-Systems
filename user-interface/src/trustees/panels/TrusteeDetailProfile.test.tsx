import { render, screen } from '@testing-library/react';
import { beforeEach, vi } from 'vitest';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import TrusteeDetailProfile, { TrusteeDetailProfileProps } from './TrusteeDetailProfile';
import { Trustee } from '@common/cams/trustees';
import TestingUtilities, { CamsUserEvent } from '@/lib/testing/testing-utilities';

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
    website: 'https://www.johndoe-trustee.com',
  },
  internal: {
    address: {
      address1: '456 Internal St',
      city: 'Internal City',
      state: 'CA',
      zipCode: '54321',
      countryCode: 'US',
    },
    phone: { number: '555-987-6543', extension: '5678' },
    email: 'john.doe.internal@example.com',
    website: 'https://internal.johndoe-trustee.com',
  },
  updatedBy: SYSTEM_USER_REFERENCE,
  updatedOn: '2024-01-01T00:00:00Z',
};

const mockOnEditPublicProfile = vi.fn();
const mockOnEditInternalProfile = vi.fn();
const mockOnEditOtherInformation = vi.fn();

function renderWithProps(props?: Partial<TrusteeDetailProfileProps>) {
  const defaultProps: TrusteeDetailProfileProps = {
    trustee: mockTrustee,
    onEditPublicProfile: mockOnEditPublicProfile,
    onEditInternalProfile: mockOnEditInternalProfile,
    onEditOtherInformation: mockOnEditOtherInformation,
  };

  const renderProps = { ...defaultProps, ...props };
  render(<TrusteeDetailProfile {...renderProps} />);
}

describe('TrusteeDetailProfile', () => {
  let userEvent: CamsUserEvent;

  beforeEach(() => {
    vi.clearAllMocks();
    userEvent = TestingUtilities.setupUserEvent();
  });

  test('should render public trustee overview section', () => {
    renderWithProps({});

    expect(screen.getByText('Trustee Overview (Public)')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  test('should render public contact information', () => {
    renderWithProps({});

    // Address
    expect(screen.getByTestId('trustee-street-address')).toHaveTextContent('123 Main St');
    expect(screen.getByTestId('trustee-street-address-line-2')).toHaveTextContent('c/o John Smith');
    expect(screen.getByTestId('trustee-street-address-line-3')).toHaveTextContent('Ch 7');
    expect(screen.getByTestId('trustee-city')).toHaveTextContent('Anytown');
    expect(screen.getByTestId('trustee-state')).toHaveTextContent(', NY');
    expect(screen.getByTestId('trustee-zip-code')).toHaveTextContent('12345');

    // Phone
    expect(screen.getByTestId('trustee-phone-number')).toHaveTextContent('555-123-4567, ext. 1234');

    // Email
    const publicEmailElement = screen.getByTestId('trustee-email');
    expect(publicEmailElement).toBeInTheDocument();
    const internalEmailElement = screen.getByTestId('trustee-internal-email');
    expect(internalEmailElement).toBeInTheDocument();
    const emailLink = screen.getByRole('link', { name: /john.doe.public@example.com/ });
    expect(emailLink).toHaveAttribute('href', 'mailto:john.doe.public@example.com');

    // Website
    expect(screen.getByTestId('trustee-website')).toBeInTheDocument();
    const websiteLink = screen.getByRole('link', { name: /www\.johndoe-trustee\.com/ });
    expect(websiteLink).toHaveAttribute('href', 'https://www.johndoe-trustee.com');
  });

  test('should render internal contact information section', () => {
    renderWithProps({});

    expect(screen.getByText('Contact Information (USTP Internal)')).toBeInTheDocument();
    expect(
      screen.getByText('USTP Internal information is for internal use only.'),
    ).toBeInTheDocument();
  });

  test('should render internal contact details when available', () => {
    renderWithProps({});

    // Internal address
    expect(screen.getByTestId('trustee-internal-street-address')).toHaveTextContent(
      '456 Internal St',
    );
    expect(screen.getByTestId('trustee-internal-city')).toHaveTextContent('Internal City');
    expect(screen.getByTestId('trustee-internal-state')).toHaveTextContent(', CA');
    expect(screen.getByTestId('trustee-internal-zip-code')).toHaveTextContent('54321');

    // Internal phone
    expect(screen.getByTestId('trustee-internal-phone-number')).toHaveTextContent(
      '555-987-6543, ext. 5678',
    );

    // Internal email
    const internalEmailLink = screen.getByRole('link', { name: /john.doe.internal@example.com/ });
    expect(internalEmailLink).toHaveAttribute('href', 'mailto:john.doe.internal@example.com');

    // Internal website
    expect(screen.getByTestId('trustee-internal-website')).toBeInTheDocument();
    const internalWebsiteLink = screen.getByRole('link', {
      name: /internal\.johndoe-trustee\.com/,
    });
    expect(internalWebsiteLink).toHaveAttribute('href', 'https://internal.johndoe-trustee.com');
  });

  test('should show "No information added" when internal contact is missing', () => {
    const trusteeWithoutInternal = { ...mockTrustee, internal: undefined };

    renderWithProps({ trustee: trusteeWithoutInternal });

    expect(screen.getByText('No information added.')).toBeInTheDocument();
  });

  test('should call onEditPublicProfile when public edit button is clicked', async () => {
    const userEvent = TestingUtilities.setupUserEvent();
    renderWithProps({});

    const publicEditButton = screen.getByRole('button', {
      name: 'Edit trustee public overview information',
    });
    await userEvent.click(publicEditButton);

    expect(mockOnEditPublicProfile).toHaveBeenCalledTimes(1);
  });

  test('should call onEditInternalProfile when internal edit button is clicked', async () => {
    renderWithProps({});

    const internalEditButton = screen.getByRole('button', {
      name: 'Edit trustee internal contact information',
    });
    await userEvent.click(internalEditButton);

    expect(mockOnEditInternalProfile).toHaveBeenCalledTimes(1);
  });

  test('should handle missing public address', () => {
    const trusteeWithoutAddress: Trustee = {
      ...mockTrustee,
      public: {
        ...mockTrustee.public,
        address: {
          address1: '',
          city: '',
          state: '',
          zipCode: '',
          countryCode: 'US',
        },
      },
    };

    renderWithProps({ trustee: trusteeWithoutAddress });

    expect(screen.queryByTestId('trustee-street-address')).not.toBeInTheDocument();
  });

  test('should handle missing public phone', () => {
    const trusteeWithoutPhone = {
      ...mockTrustee,
      public: { ...mockTrustee.public, phone: undefined },
    };

    renderWithProps({ trustee: trusteeWithoutPhone });

    expect(screen.queryByTestId('trustee-phone-number')).not.toBeInTheDocument();
  });

  test('should handle missing public email', () => {
    const trusteeWithoutEmail = {
      ...mockTrustee,
      public: { ...mockTrustee.public, email: undefined },
    };

    renderWithProps({ trustee: trusteeWithoutEmail });

    expect(
      screen.queryByRole('link', { name: /john.doe.public@example.com/ }),
    ).not.toBeInTheDocument();
  });

  test('should handle missing public website', () => {
    const trusteeWithoutPublicWebsite = {
      ...mockTrustee,
      public: { ...mockTrustee.public, website: undefined },
    };

    renderWithProps({ trustee: trusteeWithoutPublicWebsite });

    expect(screen.queryByTestId('trustee-website')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /www\.johndoe-trustee\.com/ }),
    ).not.toBeInTheDocument();
  });

  test('should handle missing internal website', () => {
    const trusteeWithoutInternalWebsite: Trustee = {
      ...mockTrustee,
      internal: {
        address: mockTrustee.internal!.address,
        phone: mockTrustee.internal!.phone,
        email: mockTrustee.internal!.email,
        // website intentionally omitted
      },
    };

    renderWithProps({ trustee: trusteeWithoutInternalWebsite });

    expect(screen.queryByTestId('trustee-internal-website')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /internal\.johndoe-trustee\.com/ }),
    ).not.toBeInTheDocument();
  });

  test('should handle phone number without extension', () => {
    const trusteeWithPhoneNoExtension = {
      ...mockTrustee,
      public: {
        ...mockTrustee.public,
        phone: { number: '555-999-8888' },
      },
    };

    renderWithProps({ trustee: trusteeWithPhoneNoExtension });

    expect(screen.getByTestId('trustee-phone-number')).toHaveTextContent('555-999-8888');
    expect(screen.getByTestId('trustee-phone-number')).not.toHaveTextContent('x');
  });

  test('should handle internal phone number without extension', () => {
    const trusteeWithInternalPhoneNoExtension = {
      ...mockTrustee,
      internal: {
        ...mockTrustee.internal!,
        phone: { number: '555-111-2222' },
      },
    };

    renderWithProps({ trustee: trusteeWithInternalPhoneNoExtension });

    expect(screen.getByTestId('trustee-internal-phone-number')).toHaveTextContent('555-111-2222');
    expect(screen.getByTestId('trustee-internal-phone-number')).not.toHaveTextContent('x');
  });

  test('should render edit button labels correctly', () => {
    renderWithProps({});

    expect(screen.getAllByText('Edit')).toHaveLength(3); // Three edit buttons: Public, Other Information, Internal
  });

  test('should render bank information when banks are present', () => {
    const trusteeWithBanks = {
      ...mockTrustee,
      banks: ['First National Bank', 'Second Trust Bank'],
    };

    renderWithProps({ trustee: trusteeWithBanks });

    expect(screen.getByText('Bank: First National Bank')).toBeInTheDocument();
    expect(screen.getByText('Bank: Second Trust Bank')).toBeInTheDocument();
  });

  test('should render single bank when only one bank is present', () => {
    const trusteeWithOneBank = {
      ...mockTrustee,
      banks: ['Single Trust Bank'],
    };

    renderWithProps({ trustee: trusteeWithOneBank });

    expect(screen.getByText('Bank: Single Trust Bank')).toBeInTheDocument();
  });

  test('should render "No information has been entered" when banks array is undefined', () => {
    const trusteeWithoutBanks = {
      ...mockTrustee,
      banks: undefined,
    };

    renderWithProps({ trustee: trusteeWithoutBanks });

    expect(screen.getByText('No information has been entered.')).toBeInTheDocument();
    expect(screen.queryByText(/Bank: /)).not.toBeInTheDocument();
  });

  test('should render "No information has been entered" when banks array is empty', () => {
    const trusteeWithEmptyBanks = {
      ...mockTrustee,
      banks: [],
    };

    renderWithProps({ trustee: trusteeWithEmptyBanks });

    expect(screen.getByText('No information has been entered.')).toBeInTheDocument();
    expect(screen.queryByText(/Bank: /)).not.toBeInTheDocument();
  });

  test('should call onEditOtherInformation when other information edit button is clicked', async () => {
    renderWithProps({});

    const otherInfoEditButton = screen.getByRole('button', {
      name: 'Edit other trustee information',
    });
    await userEvent.click(otherInfoEditButton);

    expect(mockOnEditOtherInformation).toHaveBeenCalledTimes(1);
  });

  test('should render software information when software is present', () => {
    const trusteeWithSoftware = {
      ...mockTrustee,
      software: 'BestCase Trustee Software v2.1',
    };

    renderWithProps({ trustee: trusteeWithSoftware });

    expect(screen.getByText('Software: BestCase Trustee Software v2.1')).toBeInTheDocument();
  });
});
