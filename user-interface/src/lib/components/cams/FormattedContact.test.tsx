import { render, screen } from '@testing-library/react';
import { ContactInformation } from '@common/cams/contact';
import FormattedContact, { FormattedContactProps } from './FormattedContact';

describe('FormattedAddress component', () => {
  const mockFullContact: ContactInformation = {
    address: {
      address1: '123 Main St',
      address2: 'Suite 100',
      address3: 'Floor 2',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      countryCode: 'US',
    },
    phone: {
      number: '555-123-4567',
      extension: '123',
    },
    email: 'john.doe@example.com',
    website: 'https://www.example.com',
    companyName: 'Example Company LLC',
  };

  const renderComponent = (props: FormattedContactProps) => {
    return render(<FormattedContact {...props} />);
  };

  describe('when contact is undefined', () => {
    test('should display "(none)"', () => {
      renderComponent({ contact: undefined });
      expect(screen.getByText('(none)')).toBeInTheDocument();
    });
  });

  describe('when contact is provided', () => {
    test('should render complete contact information with all fields', () => {
      renderComponent({ contact: mockFullContact, testIdPrefix: 'test' });

      // Company name
      expect(screen.getByTestId('test-company-name')).toHaveTextContent('Example Company LLC');

      // Address fields
      expect(screen.getByTestId('test-street-address')).toHaveTextContent('123 Main St');
      expect(screen.getByTestId('test-street-address-line-2')).toHaveTextContent('Suite 100');
      expect(screen.getByTestId('test-street-address-line-3')).toHaveTextContent('Floor 2');
      expect(screen.getByTestId('test-city')).toHaveTextContent('New York');
      expect(screen.getByTestId('test-state')).toHaveTextContent(', NY');
      expect(screen.getByTestId('test-zip-code')).toBeInTheDocument();

      // Check that the zip code element exists and verify its content more flexibly
      const zipElement = screen.getByTestId('test-zip-code');
      expect(zipElement.textContent).toContain('10001');

      // Phone with extension
      expect(screen.getByTestId('test-phone-number')).toHaveTextContent('555-123-4567 ext. 123');

      // Email as link (default behavior)
      expect(screen.getByTestId('test-email')).toBeInTheDocument();
      const emailLink = screen.getByRole('link', { name: /john\.doe@example\.com/ });
      expect(emailLink).toHaveAttribute('href', 'mailto:john.doe@example.com');

      // Website
      expect(screen.getByTestId('test-website')).toBeInTheDocument();
    });

    test('should render contact with partial address information', () => {
      const partialContact: ContactInformation = {
        address: {
          address1: '456 Oak Ave',
          city: 'Boston',
          state: 'MA',
          zipCode: '',
          countryCode: 'US',
        },
        email: 'jane@example.com',
      };

      renderComponent({ contact: partialContact, testIdPrefix: 'partial' });

      expect(screen.getByTestId('partial-street-address')).toHaveTextContent('456 Oak Ave');
      expect(screen.getByTestId('partial-city')).toHaveTextContent('Boston');
      expect(screen.getByTestId('partial-state')).toHaveTextContent(', MA');
      expect(screen.getByTestId('partial-zip-code')).toHaveTextContent('');
      expect(screen.queryByTestId('partial-street-address-line-2')).not.toBeInTheDocument();
      expect(screen.queryByTestId('partial-street-address-line-3')).not.toBeInTheDocument();
      expect(screen.queryByTestId('partial-phone-number')).not.toBeInTheDocument();
      expect(screen.getByTestId('partial-email')).toBeInTheDocument();
    });

    test('should render phone number without extension', () => {
      const contactWithPhoneOnly: ContactInformation = {
        address: {
          address1: '789 Phone St',
          city: 'Denver',
          state: 'CO',
          zipCode: '80202',
          countryCode: 'US',
        },
        phone: {
          number: '555-987-6543',
        },
      };

      renderComponent({ contact: contactWithPhoneOnly, testIdPrefix: 'phone-only' });

      expect(screen.getByTestId('phone-only-phone-number')).toHaveTextContent('555-987-6543');
      expect(screen.queryByText('x')).not.toBeInTheDocument();
    });

    test('should render email as plain text when emailAsLink is false', () => {
      const emailOnlyContact: ContactInformation = {
        address: {
          address1: '321 Email Ave',
          city: 'Portland',
          state: 'OR',
          zipCode: '97201',
          countryCode: 'US',
        },
        email: 'test@example.com',
      };

      renderComponent({
        contact: emailOnlyContact,
        showLinks: false,
        testIdPrefix: 'plain-email',
      });

      expect(screen.getByTestId('plain-email-email')).toHaveTextContent('test@example.com');
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    test('should apply custom className', () => {
      renderComponent({ contact: mockFullContact, className: 'custom-style' });

      const container = screen.getByText('123 Main St').closest('.formatted-contact');
      expect(container).toHaveClass('custom-style', 'formatted-contact');
    });

    test('should not render test IDs when testIdPrefix is not provided', () => {
      renderComponent({ contact: mockFullContact });

      expect(screen.getByText('123 Main St')).not.toHaveAttribute('data-testid');
      expect(screen.getByText('555-123-4567 ext. 123')).not.toHaveAttribute('data-testid');
    });

    test('should handle contact with only address1 and no city/state/zip', () => {
      const minimalAddress: ContactInformation = {
        address: {
          address1: '789 Minimal St',
          city: '',
          state: '',
          zipCode: '',
          countryCode: 'US',
        },
      };

      renderComponent({ contact: minimalAddress, testIdPrefix: 'minimal' });

      expect(screen.getByTestId('minimal-street-address')).toHaveTextContent('789 Minimal St');
      expect(screen.queryByTestId('minimal-city')).not.toBeInTheDocument();
      expect(screen.queryByTestId('minimal-state')).not.toBeInTheDocument();
      expect(screen.queryByTestId('minimal-zip-code')).not.toBeInTheDocument();
    });

    test('should handle contact with only city', () => {
      const cityOnlyContact: ContactInformation = {
        address: {
          address1: '',
          city: 'Chicago',
          state: '',
          zipCode: '',
          countryCode: 'US',
        },
      };

      renderComponent({ contact: cityOnlyContact, testIdPrefix: 'city-only' });

      expect(screen.getByTestId('city-only-city')).toHaveTextContent('Chicago');
      expect(screen.getByTestId('city-only-state')).toHaveTextContent('');
      expect(screen.getByTestId('city-only-zip-code')).toHaveTextContent('');
    });

    test('should handle contact with only state', () => {
      const stateOnlyContact: ContactInformation = {
        address: {
          address1: '',
          city: '',
          state: 'CA',
          zipCode: '',
          countryCode: 'US',
        },
      };

      renderComponent({ contact: stateOnlyContact, testIdPrefix: 'state-only' });

      expect(screen.getByTestId('state-only-city')).toHaveTextContent('');
      expect(screen.getByTestId('state-only-state')).toHaveTextContent(', CA');
      expect(screen.getByTestId('state-only-zip-code')).toHaveTextContent('');
    });

    test('should handle contact with only zip code', () => {
      const zipOnlyContact: ContactInformation = {
        address: {
          address1: '',
          city: '',
          state: '',
          zipCode: '90210',
          countryCode: 'US',
        },
      };

      renderComponent({ contact: zipOnlyContact, testIdPrefix: 'zip-only' });

      expect(screen.getByTestId('zip-only-city')).toHaveTextContent('');
      expect(screen.getByTestId('zip-only-state')).toHaveTextContent('');
      expect(screen.getByTestId('zip-only-zip-code')).toBeInTheDocument();

      // Check that the zip code element exists and verify its content more flexibly
      const zipElement = screen.getByTestId('zip-only-zip-code');
      expect(zipElement.textContent).toContain('90210');
    });

    test('should handle contact with empty address object', () => {
      const emptyAddressContact: ContactInformation = {
        address: {
          address1: '',
          city: '',
          state: '',
          zipCode: '',
          countryCode: 'US',
        },
        email: 'empty.address@example.com',
      };

      renderComponent({ contact: emptyAddressContact, testIdPrefix: 'empty-addr' });

      expect(screen.queryByTestId('empty-addr-street-address')).not.toBeInTheDocument();
      expect(screen.queryByTestId('empty-addr-city')).not.toBeInTheDocument();
      expect(screen.getByTestId('empty-addr-email')).toBeInTheDocument();
    });

    test('should handle contact with phone number that has empty extension', () => {
      const phoneWithEmptyExtension: ContactInformation = {
        address: {
          address1: '555 Extension St',
          city: 'Austin',
          state: 'TX',
          zipCode: '73301',
          countryCode: 'US',
        },
        phone: {
          number: '555-444-3333',
          extension: '',
        },
      };

      renderComponent({ contact: phoneWithEmptyExtension, testIdPrefix: 'empty-ext' });

      expect(screen.getByTestId('empty-ext-phone-number')).toHaveTextContent('555-444-3333');
      expect(screen.queryByText('x')).not.toBeInTheDocument();
    });

    test('should handle contact with empty phone number', () => {
      const emptyPhoneContact: ContactInformation = {
        address: {
          address1: '123 No Phone St',
          city: 'Seattle',
          state: 'WA',
          zipCode: '98101',
          countryCode: 'US',
        },
        phone: {
          number: '',
          extension: '999',
        },
        email: 'phone.empty@example.com',
      };

      renderComponent({ contact: emptyPhoneContact, testIdPrefix: 'empty-phone' });

      expect(screen.queryByTestId('empty-phone-phone-number')).not.toBeInTheDocument();
      expect(screen.getByTestId('empty-phone-email')).toBeInTheDocument();
    });

    test('should handle completely empty contact object', () => {
      const emptyContact: ContactInformation = {
        address: {
          address1: '',
          city: '',
          state: '',
          zipCode: '',
          countryCode: 'US',
        },
      };

      renderComponent({ contact: emptyContact });

      expect(screen.queryByText('123 Main St')).not.toBeInTheDocument();
      expect(screen.queryByText('555-123-4567')).not.toBeInTheDocument();
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
      expect(screen.queryByText('john.doe@example.com')).not.toBeInTheDocument();
    });
  });

  describe('website display', () => {
    test('should render website as link when showLinks is true (default)', () => {
      const contactWithWebsite: ContactInformation = {
        address: {
          address1: '123 Website St',
          city: 'Austin',
          state: 'TX',
          zipCode: '78701',
          countryCode: 'US',
        },
        website: 'https://www.example-trustee.com',
      };

      renderComponent({ contact: contactWithWebsite, testIdPrefix: 'website-link' });

      expect(screen.getByTestId('website-link-website')).toBeInTheDocument();
      const websiteLink = screen.getByRole('link', { name: /www\.example-trustee\.com/ });
      expect(websiteLink).toHaveAttribute('href', 'https://www.example-trustee.com');
    });

    test('should render website as plain text when showLinks is false', () => {
      const contactWithWebsite: ContactInformation = {
        address: {
          address1: '123 Website St',
          city: 'Austin',
          state: 'TX',
          zipCode: '78701',
          countryCode: 'US',
        },
        website: 'https://www.example-trustee.com',
      };

      renderComponent({
        contact: contactWithWebsite,
        showLinks: false,
        testIdPrefix: 'website-text',
      });

      expect(screen.getByTestId('website-text-website')).toHaveTextContent(
        'https://www.example-trustee.com',
      );
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    test('should not render website element when website is undefined', () => {
      const contactWithoutWebsite: ContactInformation = {
        address: {
          address1: '123 No Website St',
          city: 'Denver',
          state: 'CO',
          zipCode: '80202',
          countryCode: 'US',
        },
        email: 'no-website@example.com',
      };

      renderComponent({ contact: contactWithoutWebsite, testIdPrefix: 'no-website' });

      expect(screen.queryByTestId('no-website-website')).not.toBeInTheDocument();
      expect(screen.getByTestId('no-website-email')).toBeInTheDocument();
    });

    test('should not render website element when website is empty string', () => {
      const contactWithEmptyWebsite: ContactInformation = {
        address: {
          address1: '123 Empty Website St',
          city: 'Phoenix',
          state: 'AZ',
          zipCode: '85001',
          countryCode: 'US',
        },
        website: '',
        email: 'empty-website@example.com',
      };

      renderComponent({ contact: contactWithEmptyWebsite, testIdPrefix: 'empty-website' });

      expect(screen.queryByTestId('empty-website-website')).not.toBeInTheDocument();
      expect(screen.getByTestId('empty-website-email')).toBeInTheDocument();
    });

    test('should generate correct testId when testIdPrefix is provided', () => {
      const contactWithWebsite: ContactInformation = {
        address: {
          address1: '123 TestId St',
          city: 'Portland',
          state: 'OR',
          zipCode: '97201',
          countryCode: 'US',
        },
        website: 'https://www.testid-example.com',
      };

      renderComponent({ contact: contactWithWebsite, testIdPrefix: 'custom-prefix' });

      expect(screen.getByTestId('custom-prefix-website')).toBeInTheDocument();
    });

    test('should not have testId when testIdPrefix is not provided', () => {
      const contactWithWebsite: ContactInformation = {
        address: {
          address1: '123 No TestId St',
          city: 'Seattle',
          state: 'WA',
          zipCode: '98101',
          countryCode: 'US',
        },
        website: 'https://www.no-testid.com',
      };

      renderComponent({ contact: contactWithWebsite });

      const websiteElement = screen.getByText(contactWithWebsite.website!).closest('.website');
      expect(websiteElement).not.toHaveAttribute('data-testid');
    });

    test('should have correct CSS class for website element', () => {
      const contactWithWebsite: ContactInformation = {
        address: {
          address1: '123 CSS Class St',
          city: 'Miami',
          state: 'FL',
          zipCode: '33101',
          countryCode: 'US',
        },
        website: 'https://www.css-class-test.com',
      };

      renderComponent({ contact: contactWithWebsite });

      const websiteElement = screen.getByText(contactWithWebsite.website!).closest('.website');
      expect(websiteElement).toHaveClass('website');
    });
  });

  describe('styling and layout', () => {
    test('should have the correct CSS classes', () => {
      renderComponent({ contact: mockFullContact });

      const container = screen.getByText('123 Main St').closest('.formatted-contact');
      expect(container).toHaveClass('formatted-contact');
    });

    test('should properly structure address parts', () => {
      renderComponent({ contact: mockFullContact });

      const address1 = screen.getByText('123 Main St');
      const address2 = screen.getByText('Suite 100');
      const address3 = screen.getByText('Floor 2');

      expect(address1).toHaveClass('address1');
      expect(address2).toHaveClass('address2');
      expect(address3).toHaveClass('address3');
    });

    test('should structure city-state-zip correctly', () => {
      renderComponent({ contact: mockFullContact, testIdPrefix: 'layout' });

      const cityStateZipContainer = screen.getByTestId('layout-city').parentElement;
      expect(cityStateZipContainer).toHaveClass('city-state-zip');
    });
  });

  describe('company name display', () => {
    test('should render company name when provided', () => {
      const contactWithCompanyName: ContactInformation = {
        address: {
          address1: '123 Company St',
          city: 'Chicago',
          state: 'IL',
          zipCode: '60601',
          countryCode: 'US',
        },
        companyName: 'Test Company LLC',
      };

      renderComponent({ contact: contactWithCompanyName, testIdPrefix: 'company' });

      expect(screen.getByTestId('company-company-name')).toHaveTextContent('Test Company LLC');
    });

    test('should not render company name element when company name is undefined', () => {
      const contactWithoutCompanyName: ContactInformation = {
        address: {
          address1: '123 No Company St',
          city: 'Denver',
          state: 'CO',
          zipCode: '80202',
          countryCode: 'US',
        },
        email: 'no-company@example.com',
      };

      renderComponent({ contact: contactWithoutCompanyName, testIdPrefix: 'no-company' });

      expect(screen.queryByTestId('no-company-company-name')).not.toBeInTheDocument();
      expect(screen.getByTestId('no-company-email')).toBeInTheDocument();
    });

    test('should not render company name element when company name is empty string', () => {
      const contactWithEmptyCompanyName: ContactInformation = {
        address: {
          address1: '123 Empty Company St',
          city: 'Phoenix',
          state: 'AZ',
          zipCode: '85001',
          countryCode: 'US',
        },
        companyName: '',
        email: 'empty-company@example.com',
      };

      renderComponent({ contact: contactWithEmptyCompanyName, testIdPrefix: 'empty-company' });

      expect(screen.queryByTestId('empty-company-company-name')).not.toBeInTheDocument();
      expect(screen.getByTestId('empty-company-email')).toBeInTheDocument();
    });

    test('should generate correct testId when testIdPrefix is provided and have correct CSS class', () => {
      const contactWithCompanyName: ContactInformation = {
        address: {
          address1: '123 TestId St',
          city: 'Portland',
          state: 'OR',
          zipCode: '97201',
          countryCode: 'US',
        },
        companyName: 'TestId Company Inc',
      };

      const { rerender } = renderComponent({
        contact: contactWithCompanyName,
        testIdPrefix: 'custom-prefix',
      });

      const companyElementWithPrefix = screen.getByTestId('custom-prefix-company-name');
      expect(companyElementWithPrefix).toBeInTheDocument();
      expect(companyElementWithPrefix).toHaveClass('company-name');

      // Re-render without testIdPrefix to verify no testId is present
      rerender(<FormattedContact contact={contactWithCompanyName} />);

      const companyElement = screen.getByText('TestId Company Inc').closest('.company-name');
      expect(companyElement).not.toHaveAttribute('data-testid');
      expect(companyElement).toHaveClass('company-name');
    });
  });
});
