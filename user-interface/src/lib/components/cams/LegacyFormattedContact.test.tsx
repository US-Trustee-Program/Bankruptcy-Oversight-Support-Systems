import { render, screen } from '@testing-library/react';
import { LegacyAddress } from '@common/cams/parties';
import LegacyFormattedContact, { LegacyFormattedContactProps } from './LegacyFormattedContact';

describe('LegacyFormattedAddress component', () => {
  const mockFullLegacy: LegacyAddress & { phone?: string; email?: string } = {
    address1: '123 Legacy St',
    address2: 'Unit B',
    address3: 'Building 5',
    cityStateZipCountry: 'Dallas, TX 75201',
    phone: '214-555-0123 x456',
    email: 'legacy@example.com',
  };

  const renderComponent = (props: LegacyFormattedContactProps) => {
    return render(<LegacyFormattedContact {...props} />);
  };

  describe('when legacy is undefined', () => {
    test('should display "(none)"', () => {
      renderComponent({ legacy: undefined });
      expect(screen.getByText('(none)')).toBeInTheDocument();
    });
  });

  describe('when legacy is provided', () => {
    test('should render complete legacy contact information with all fields', () => {
      renderComponent({ legacy: mockFullLegacy, testIdPrefix: 'test' });

      // Address fields
      expect(screen.getByTestId('test-address1')).toHaveTextContent('123 Legacy St');
      expect(screen.getByTestId('test-address2')).toHaveTextContent('Unit B');
      expect(screen.getByTestId('test-address3')).toHaveTextContent('Building 5');
      expect(screen.getByTestId('test-city-state-zip')).toHaveTextContent('Dallas, TX 75201');

      // Phone (now formatted by parsePhoneNumber and rendered as link via CommsLink)
      expect(screen.getByTestId('test-phone-number')).toHaveTextContent('214-555-0123 ext. 456');

      // Email as link (default behavior)
      expect(screen.getByTestId('test-email')).toBeInTheDocument();
      const emailLink = screen.getByRole('link', { name: /email/i });
      expect(emailLink).toHaveAttribute('href', 'mailto:legacy@example.com');
    });

    test('should render legacy contact with partial address information', () => {
      const partialLegacy: LegacyAddress & { phone?: string; email?: string } = {
        address1: '456 Partial Ave',
        cityStateZipCountry: 'Austin, TX 78701',
        email: 'partial@example.com',
      };

      renderComponent({ legacy: partialLegacy, testIdPrefix: 'partial' });

      expect(screen.getByTestId('partial-address1')).toHaveTextContent('456 Partial Ave');
      expect(screen.getByTestId('partial-city-state-zip')).toHaveTextContent('Austin, TX 78701');
      expect(screen.queryByTestId('partial-address2')).not.toBeInTheDocument();
      expect(screen.queryByTestId('partial-address3')).not.toBeInTheDocument();
      expect(screen.queryByTestId('partial-phone-number')).not.toBeInTheDocument();
      expect(screen.getByTestId('partial-email')).toBeInTheDocument();
    });

    test('should render only phone when provided', () => {
      const phoneOnlyLegacy: LegacyAddress & { phone?: string; email?: string } = {
        phone: '555-987-6543',
      };

      renderComponent({ legacy: phoneOnlyLegacy, testIdPrefix: 'phone-only' });

      expect(screen.getByTestId('phone-only-phone-number')).toHaveTextContent('555-987-6543');
      expect(screen.queryByTestId('phone-only-address1')).not.toBeInTheDocument();
      expect(screen.queryByTestId('phone-only-email')).not.toBeInTheDocument();
    });

    test('should render phone as clickable link with aria-label', () => {
      const phoneOnlyLegacy: LegacyAddress & { phone?: string; email?: string } = {
        phone: '555-987-6543',
      };

      renderComponent({ legacy: phoneOnlyLegacy, testIdPrefix: 'phone-link' });

      const phoneLink = screen.getByRole('link', { name: /phone/i });
      expect(phoneLink).toHaveAttribute('href', 'tel:+15559876543');
      expect(phoneLink).toHaveAttribute('aria-label', 'Phone: 555-987-6543');
    });

    test('should render phone with extension as clickable link', () => {
      const phoneWithExtLegacy: LegacyAddress & { phone?: string; email?: string } = {
        phone: '555-123-4567 x123',
      };

      renderComponent({ legacy: phoneWithExtLegacy, testIdPrefix: 'phone-ext' });

      const phoneLink = screen.getByRole('link', { name: /phone/i });
      expect(phoneLink).toHaveAttribute('href', 'tel:+15551234567;ext=123');
      expect(phoneLink).toHaveAttribute('aria-label', 'Phone: 555-123-4567 ext. 123');
    });

    test('should render email as plain text when emailAsLink is false', () => {
      const emailOnlyLegacy: LegacyAddress & { phone?: string; email?: string } = {
        email: 'plaintext@example.com',
      };

      renderComponent({
        legacy: emailOnlyLegacy,
        emailAsLink: false,
        testIdPrefix: 'plain-email',
      });

      expect(screen.getByTestId('plain-email-email')).toHaveTextContent('plaintext@example.com');
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    test('should render email link with custom subject', () => {
      const emailLegacy: LegacyAddress & { phone?: string; email?: string } = {
        email: 'subject@example.com',
      };

      renderComponent({
        legacy: emailLegacy,
        emailSubject: 'Important Matter',
        testIdPrefix: 'subject-email',
      });

      const emailLink = screen.getByRole('link');
      expect(emailLink).toHaveAttribute(
        'href',
        'mailto:subject@example.com?subject=Important Matter',
      );
    });

    test('should render email link with descriptive aria-label', () => {
      const emailLegacy: LegacyAddress & { phone?: string; email?: string } = {
        email: 'accessible@example.com',
      };

      renderComponent({
        legacy: emailLegacy,
        testIdPrefix: 'aria-email',
      });

      const emailLink = screen.getByRole('link');
      expect(emailLink).toHaveAttribute('aria-label', 'Email: accessible@example.com');
    });

    test('should apply custom className', () => {
      renderComponent({ legacy: mockFullLegacy, className: 'custom-legacy-style' });

      const container = screen.getByText('123 Legacy St').closest('.formatted-address');
      expect(container).toHaveClass('custom-legacy-style', 'formatted-address');
    });

    test('should not render test IDs when testIdPrefix is not provided', () => {
      renderComponent({ legacy: mockFullLegacy });

      expect(screen.getByText('123 Legacy St')).not.toHaveAttribute('data-testid');
      // Phone is now rendered via CommsLink, verify the container doesn't have testid
      expect(screen.getByText('214-555-0123 ext. 456').closest('.phone')).not.toHaveAttribute(
        'data-testid',
      );
    });

    test('should handle legacy with only address1', () => {
      const address1OnlyLegacy: LegacyAddress = {
        address1: '789 Solo St',
      };

      renderComponent({ legacy: address1OnlyLegacy, testIdPrefix: 'address1-only' });

      expect(screen.getByTestId('address1-only-address1')).toHaveTextContent('789 Solo St');
      expect(screen.queryByTestId('address1-only-address2')).not.toBeInTheDocument();
      expect(screen.queryByTestId('address1-only-address3')).not.toBeInTheDocument();
      expect(screen.queryByTestId('address1-only-city-state-zip')).not.toBeInTheDocument();
    });

    test('should handle legacy with only address2', () => {
      const address2OnlyLegacy: LegacyAddress = {
        address2: 'Apt 42',
      };

      renderComponent({ legacy: address2OnlyLegacy, testIdPrefix: 'address2-only' });

      expect(screen.getByTestId('address2-only-address2')).toHaveTextContent('Apt 42');
      expect(screen.queryByTestId('address2-only-address1')).not.toBeInTheDocument();
      expect(screen.queryByTestId('address2-only-address3')).not.toBeInTheDocument();
      expect(screen.queryByTestId('address2-only-city-state-zip')).not.toBeInTheDocument();
    });

    test('should handle legacy with only address3', () => {
      const address3OnlyLegacy: LegacyAddress = {
        address3: 'Floor 10',
      };

      renderComponent({ legacy: address3OnlyLegacy, testIdPrefix: 'address3-only' });

      expect(screen.getByTestId('address3-only-address3')).toHaveTextContent('Floor 10');
      expect(screen.queryByTestId('address3-only-address1')).not.toBeInTheDocument();
      expect(screen.queryByTestId('address3-only-address2')).not.toBeInTheDocument();
      expect(screen.queryByTestId('address3-only-city-state-zip')).not.toBeInTheDocument();
    });

    test('should handle legacy with only cityStateZipCountry', () => {
      const cityStateZipOnlyLegacy: LegacyAddress = {
        cityStateZipCountry: 'Phoenix, AZ 85001',
      };

      renderComponent({ legacy: cityStateZipOnlyLegacy, testIdPrefix: 'city-state-zip-only' });

      expect(screen.getByTestId('city-state-zip-only-city-state-zip')).toHaveTextContent(
        'Phoenix, AZ 85001',
      );
      expect(screen.queryByTestId('city-state-zip-only-address1')).not.toBeInTheDocument();
      expect(screen.queryByTestId('city-state-zip-only-address2')).not.toBeInTheDocument();
      expect(screen.queryByTestId('city-state-zip-only-address3')).not.toBeInTheDocument();
    });

    test('should handle legacy with empty phone', () => {
      const emptyPhoneLegacy: LegacyAddress & { phone?: string; email?: string } = {
        address1: '123 No Phone St',
        phone: '',
        email: 'nophone@example.com',
      };

      renderComponent({ legacy: emptyPhoneLegacy, testIdPrefix: 'empty-phone' });

      expect(screen.queryByTestId('empty-phone-phone-number')).not.toBeInTheDocument();
      expect(screen.getByTestId('empty-phone-address1')).toHaveTextContent('123 No Phone St');
      expect(screen.getByTestId('empty-phone-email')).toBeInTheDocument();
    });

    test('should handle legacy with empty email', () => {
      const emptyEmailLegacy: LegacyAddress & { phone?: string; email?: string } = {
        address1: '123 No Email St',
        phone: '555-111-2222',
        email: '',
      };

      renderComponent({ legacy: emptyEmailLegacy, testIdPrefix: 'empty-email' });

      expect(screen.queryByTestId('empty-email-email')).not.toBeInTheDocument();
      expect(screen.getByTestId('empty-email-address1')).toHaveTextContent('123 No Email St');
      expect(screen.getByTestId('empty-email-phone-number')).toHaveTextContent('555-111-2222');
    });

    test('should handle completely empty legacy object', () => {
      const emptyLegacy: LegacyAddress = {};

      renderComponent({ legacy: emptyLegacy });

      expect(screen.queryByText('123 Legacy St')).not.toBeInTheDocument();
      expect(screen.queryByText('214-555-0123')).not.toBeInTheDocument();
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
      expect(screen.queryByText('legacy@example.com')).not.toBeInTheDocument();
    });

    test('should handle legacy with all empty string fields', () => {
      const allEmptyLegacy: LegacyAddress & { phone?: string; email?: string } = {
        address1: '',
        address2: '',
        address3: '',
        cityStateZipCountry: '',
        phone: '',
        email: '',
      };

      renderComponent({ legacy: allEmptyLegacy, testIdPrefix: 'all-empty' });

      expect(screen.queryByTestId('all-empty-address1')).not.toBeInTheDocument();
      expect(screen.queryByTestId('all-empty-address2')).not.toBeInTheDocument();
      expect(screen.queryByTestId('all-empty-address3')).not.toBeInTheDocument();
      expect(screen.queryByTestId('all-empty-city-state-zip')).not.toBeInTheDocument();
      expect(screen.queryByTestId('all-empty-phone-number')).not.toBeInTheDocument();
      expect(screen.queryByTestId('all-empty-email')).not.toBeInTheDocument();
    });
  });

  describe('styling and layout', () => {
    test('should have the correct CSS classes', () => {
      renderComponent({ legacy: mockFullLegacy });

      const container = screen.getByText('123 Legacy St').closest('.formatted-address');
      expect(container).toHaveClass('formatted-address');
    });

    test('should properly structure address parts', () => {
      renderComponent({ legacy: mockFullLegacy });

      const address1 = screen.getByText('123 Legacy St');
      const address2 = screen.getByText('Unit B');
      const address3 = screen.getByText('Building 5');
      const cityStateZip = screen.getByText('Dallas, TX 75201');

      expect(address1).toHaveClass('address1');
      expect(address2).toHaveClass('address2');
      expect(address3).toHaveClass('address3');
      expect(cityStateZip).toHaveClass('city-state-zip');
    });

    test('should structure phone and email correctly', () => {
      renderComponent({ legacy: mockFullLegacy });

      // Phone is now rendered via CommsLink, so find the container with the phone link
      const phoneLink = screen.getByRole('link', { name: /phone/i });
      expect(phoneLink.closest('.phone')).toBeInTheDocument();

      // Email link
      const emailLink = screen.getByRole('link', { name: /email/i });
      expect(emailLink.closest('.email')).toBeInTheDocument();
    });
  });
});
