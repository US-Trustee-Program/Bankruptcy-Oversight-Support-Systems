import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import CommsLink from './CommsLink';
import { ContactInformation } from '@common/cams/contact';

// Mock the IconLabel component to simplify testing
import * as IconLabelModule from '@/lib/components/cams/IconLabel/IconLabel';

beforeEach(() => {
  vi.spyOn(IconLabelModule, 'IconLabel').mockImplementation(
    ({ label, icon }: { label: string; icon: string }) => (
      <span data-testid="icon-label" data-icon={icon}>
        {label}
      </span>
    ),
  );
});

describe('CommsLink Component', () => {
  // Test the toTelephoneUri utility function indirectly through component rendering
  describe('toTelephoneUri function', () => {
    const phoneContact: Partial<ContactInformation> = {
      phone: { number: '555-123-4567' },
    };

    test('formats phone number without extension', () => {
      render(
        <CommsLink
          contact={phoneContact as Omit<ContactInformation, 'address'>}
          mode="phone-dialer"
        />,
      );

      const link = screen.getByRole('link');
      expect(link.getAttribute('href')).toBe('tel:+15551234567');
    });

    test('formats phone number with extension', () => {
      const contactWithExtension: Partial<ContactInformation> = {
        phone: { number: '555-123-4567', extension: '123' },
      };

      render(
        <CommsLink
          contact={contactWithExtension as Omit<ContactInformation, 'address'>}
          mode="phone-dialer"
        />,
      );

      const link = screen.getByRole('link');
      expect(link.getAttribute('href')).toBe('tel:+15551234567;ext=123');
    });
  });

  // Test each mode of the CommsLink component
  describe('Mode: teams-chat', () => {
    const emailContact: Partial<ContactInformation> = {
      email: 'test@example.com',
    };

    test('renders teams-chat link with default values', () => {
      render(
        <CommsLink
          contact={emailContact as Omit<ContactInformation, 'address'>}
          mode="teams-chat"
        />,
      );

      const link = screen.getByRole('link');
      expect(link.getAttribute('href')).toBe(
        'msteams://teams.microsoft.com/l/chat/0/0?users=test@example.com',
      );

      const iconLabel = screen.getByTestId('icon-label');
      expect(iconLabel).toHaveTextContent('Chat');
      expect(iconLabel.getAttribute('data-icon')).toBe('chat');
    });

    test('renders teams-chat link with custom label and icon', () => {
      render(
        <CommsLink
          contact={emailContact as Omit<ContactInformation, 'address'>}
          mode="teams-chat"
          label="Custom Chat"
          icon="custom-icon"
        />,
      );

      const link = screen.getByRole('link');
      expect(link.getAttribute('href')).toBe(
        'msteams://teams.microsoft.com/l/chat/0/0?users=test@example.com',
      );

      const iconLabel = screen.getByTestId('icon-label');
      expect(iconLabel).toHaveTextContent('Custom Chat');
      expect(iconLabel.getAttribute('data-icon')).toBe('custom-icon');
    });
  });

  describe('Mode: teams-call', () => {
    const emailContact: Partial<ContactInformation> = {
      email: 'test@example.com',
    };

    test('renders teams-call link with default values', () => {
      render(
        <CommsLink
          contact={emailContact as Omit<ContactInformation, 'address'>}
          mode="teams-call"
        />,
      );

      const link = screen.getByRole('link');
      expect(link.getAttribute('href')).toBe(
        'msteams://teams.microsoft.com/l/call/0/0?users=test@example.com',
      );

      const iconLabel = screen.getByTestId('icon-label');
      expect(iconLabel).toHaveTextContent('Talk');
      expect(iconLabel.getAttribute('data-icon')).toBe('phone');
    });

    test('renders teams-call link with custom label and icon', () => {
      render(
        <CommsLink
          contact={emailContact as Omit<ContactInformation, 'address'>}
          mode="teams-call"
          label="Custom Call"
          icon="custom-icon"
        />,
      );

      const link = screen.getByRole('link');
      expect(link.getAttribute('href')).toBe(
        'msteams://teams.microsoft.com/l/call/0/0?users=test@example.com',
      );

      const iconLabel = screen.getByTestId('icon-label');
      expect(iconLabel).toHaveTextContent('Custom Call');
      expect(iconLabel.getAttribute('data-icon')).toBe('custom-icon');
    });
  });

  describe('Mode: phone-dialer', () => {
    test('renders phone-dialer link with default values', () => {
      const phoneContact: Partial<ContactInformation> = {
        phone: { number: '555-123-4567' },
      };

      render(
        <CommsLink
          contact={phoneContact as Omit<ContactInformation, 'address'>}
          mode="phone-dialer"
        />,
      );

      const link = screen.getByRole('link');
      expect(link.getAttribute('href')).toBe('tel:+15551234567');

      const iconLabel = screen.getByTestId('icon-label');
      expect(iconLabel).toHaveTextContent('555-123-4567');
      expect(iconLabel.getAttribute('data-icon')).toBe('phone');
    });

    test('renders phone-dialer link with extension in label', () => {
      const phoneContact: Partial<ContactInformation> = {
        phone: { number: '555-123-4567', extension: '123' },
      };

      render(
        <CommsLink
          contact={phoneContact as Omit<ContactInformation, 'address'>}
          mode="phone-dialer"
        />,
      );

      const link = screen.getByRole('link');
      expect(link.getAttribute('href')).toBe('tel:+15551234567;ext=123');

      const iconLabel = screen.getByTestId('icon-label');
      expect(iconLabel).toHaveTextContent('555-123-4567 ext. 123');
      expect(iconLabel.getAttribute('data-icon')).toBe('phone');
    });

    test('renders phone-dialer link with custom label and icon', () => {
      const phoneContact: Partial<ContactInformation> = {
        phone: { number: '555-123-4567' },
      };

      render(
        <CommsLink
          contact={phoneContact as Omit<ContactInformation, 'address'>}
          mode="phone-dialer"
          label="Custom Phone"
          icon="custom-icon"
        />,
      );

      const link = screen.getByRole('link');
      expect(link.getAttribute('href')).toBe('tel:+15551234567');

      const iconLabel = screen.getByTestId('icon-label');
      expect(iconLabel).toHaveTextContent('Custom Phone');
      expect(iconLabel.getAttribute('data-icon')).toBe('custom-icon');
    });

    test('displays phone number even when it does not match validation regex', () => {
      const phoneContact: Partial<ContactInformation> = {
        phone: { number: 'invalid-phone-format' },
      };

      render(
        <CommsLink
          contact={phoneContact as Omit<ContactInformation, 'address'>}
          mode="phone-dialer"
        />,
      );

      // Should not create a clickable link for invalid phone numbers
      const link = screen.queryByRole('link');
      expect(link).not.toBeInTheDocument();

      // But should still display the phone number with phone icon
      const iconLabel = screen.getByTestId('icon-label');
      expect(iconLabel).toHaveTextContent('invalid-phone-format');
      expect(iconLabel.getAttribute('data-icon')).toBe('phone');
    });

    test('displays unformatted phone number with extension when validation fails', () => {
      const phoneContact: Partial<ContactInformation> = {
        phone: { number: '123-456', extension: '789' },
      };

      render(
        <CommsLink
          contact={phoneContact as Omit<ContactInformation, 'address'>}
          mode="phone-dialer"
        />,
      );

      const link = screen.queryByRole('link');
      expect(link).not.toBeInTheDocument();

      const iconLabel = screen.getByTestId('icon-label');
      expect(iconLabel).toHaveTextContent('123-456 ext. 789');
      expect(iconLabel.getAttribute('data-icon')).toBe('phone');
    });
  });

  describe('Mode: email', () => {
    const emailContact: Partial<ContactInformation> = {
      email: 'test@example.com',
    };

    test('renders email link with default values', () => {
      render(
        <CommsLink contact={emailContact as Omit<ContactInformation, 'address'>} mode="email" />,
      );

      const link = screen.getByRole('link');
      expect(link.getAttribute('href')).toBe('mailto:test@example.com');

      const iconLabel = screen.getByTestId('icon-label');
      expect(iconLabel).toHaveTextContent('test@example.com');
      expect(iconLabel.getAttribute('data-icon')).toBe('mail');
    });

    test('renders email link with custom label and icon', () => {
      render(
        <CommsLink
          contact={emailContact as Omit<ContactInformation, 'address'>}
          mode="email"
          label="Custom Email"
          icon="custom-icon"
        />,
      );

      const link = screen.getByRole('link');
      expect(link.getAttribute('href')).toBe('mailto:test@example.com');

      const iconLabel = screen.getByTestId('icon-label');
      expect(iconLabel).toHaveTextContent('Custom Email');
      expect(iconLabel.getAttribute('data-icon')).toBe('custom-icon');
    });

    test('renders email link with emailSubject', () => {
      render(
        <CommsLink
          contact={emailContact as Omit<ContactInformation, 'address'>}
          mode="email"
          emailSubject="Test Subject"
        />,
      );

      const link = screen.getByRole('link');
      expect(link.getAttribute('href')).toBe('mailto:test@example.com?subject=Test%20Subject');

      const iconLabel = screen.getByTestId('icon-label');
      expect(iconLabel).toHaveTextContent('test@example.com');
      expect(iconLabel.getAttribute('data-icon')).toBe('mail');
    });

    test('renders email link with emailSubject containing special characters', () => {
      render(
        <CommsLink
          contact={emailContact as Omit<ContactInformation, 'address'>}
          mode="email"
          emailSubject="Test & Subject: With Special Characters?"
        />,
      );

      const link = screen.getByRole('link');
      expect(link.getAttribute('href')).toBe(
        'mailto:test@example.com?subject=Test%20%26%20Subject%3A%20With%20Special%20Characters%3F',
      );

      const iconLabel = screen.getByTestId('icon-label');
      expect(iconLabel).toHaveTextContent('test@example.com');
      expect(iconLabel.getAttribute('data-icon')).toBe('mail');
    });

    test('renders email link with fallback label when email is missing', () => {
      const contactWithoutEmail: Partial<ContactInformation> = {
        phone: { number: '555-123-4567' },
      };

      render(
        <CommsLink
          contact={contactWithoutEmail as Omit<ContactInformation, 'address'>}
          mode="email"
        />,
      );

      const link = screen.queryByRole('link');
      expect(link).not.toBeInTheDocument();

      const iconLabel = screen.getByTestId('icon-label');
      expect(iconLabel).toHaveTextContent('');
      expect(iconLabel.getAttribute('data-icon')).toBe('error');
    });
  });

  // Edge case - rendering without icon
  test('renders link without icon when icon is not provided', () => {
    const emailContact: Partial<ContactInformation> = {
      email: 'test@example.com',
    };

    render(
      <CommsLink
        contact={emailContact as Omit<ContactInformation, 'address'>}
        mode="email"
        label="Email Me"
        icon={undefined}
      />,
    );

    const link = screen.getByRole('link');
    expect(link).toHaveTextContent('Email Me');
  });

  describe('Website URL formatting functions', () => {
    describe('formatWebsiteUrl', () => {
      const cases = [
        ['https://example.com', 'https://example.com'],
        ['http://example.com', 'https://example.com'],
        ['example.com', 'https://example.com'],
        ['https://sub.example.com/path', 'https://sub.example.com/path'],
      ];

      test.each(cases)('formatWebsiteUrl(%s) -> %s', (input, expected) => {
        render(
          <CommsLink
            contact={{ website: input } as Omit<ContactInformation, 'address'>}
            mode="website"
          />,
        );
        const link = screen.getByRole('link');
        expect(link.getAttribute('href')).toBe(expected);
      });
    });
  });

  describe('Accessibility: aria-label', () => {
    test('phone link has descriptive aria-label', () => {
      render(
        <CommsLink
          contact={{ phone: { number: '555-123-4567' } } as Omit<ContactInformation, 'address'>}
          mode="phone-dialer"
        />,
      );

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('aria-label', 'Phone: 555-123-4567');
    });

    test('phone link with extension has descriptive aria-label', () => {
      render(
        <CommsLink
          contact={
            { phone: { number: '555-123-4567', extension: '123' } } as Omit<
              ContactInformation,
              'address'
            >
          }
          mode="phone-dialer"
        />,
      );

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('aria-label', 'Phone: 555-123-4567 ext. 123');
    });

    test('email link has descriptive aria-label', () => {
      render(
        <CommsLink
          contact={{ email: 'test@example.com' } as Omit<ContactInformation, 'address'>}
          mode="email"
        />,
      );

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('aria-label', 'Email: test@example.com');
    });

    test('website link has descriptive aria-label indicating new tab', () => {
      render(
        <CommsLink
          contact={{ website: 'https://example.com' } as Omit<ContactInformation, 'address'>}
          mode="website"
        />,
      );

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('aria-label', 'Website: https://example.com (opens in new tab)');
    });

    test('website link aria-label uses custom label directly when provided', () => {
      render(
        <CommsLink
          contact={{ website: 'https://example.com' } as Omit<ContactInformation, 'address'>}
          mode="website"
          label="Zoom Link"
        />,
      );

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('aria-label', 'Zoom Link (opens in new tab)');
    });

    test('teams-chat link has descriptive aria-label with name when provided', () => {
      render(
        <CommsLink
          contact={{ email: 'test@example.com' } as Omit<ContactInformation, 'address'>}
          mode="teams-chat"
          name="John Smith"
        />,
      );

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('aria-label', 'Start Teams chat with John Smith');
    });

    test('teams-chat link falls back to email when name not provided', () => {
      render(
        <CommsLink
          contact={{ email: 'test@example.com' } as Omit<ContactInformation, 'address'>}
          mode="teams-chat"
        />,
      );

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('aria-label', 'Start Teams chat with test@example.com');
    });

    test('teams-call link has descriptive aria-label with name when provided', () => {
      render(
        <CommsLink
          contact={{ email: 'test@example.com' } as Omit<ContactInformation, 'address'>}
          mode="teams-call"
          name="Jane Doe"
        />,
      );

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('aria-label', 'Start Teams call with Jane Doe');
    });

    test('teams-call link falls back to email when name not provided', () => {
      render(
        <CommsLink
          contact={{ email: 'test@example.com' } as Omit<ContactInformation, 'address'>}
          mode="teams-call"
        />,
      );

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('aria-label', 'Start Teams call with test@example.com');
    });
  });

  describe('Mode: website', () => {
    const cases = [
      ['https://example.com', 'https://example.com', 'https://example.com'],
      ['http://example.com', 'https://example.com', 'http://example.com'],
      ['example.com', 'https://example.com', 'example.com'],
      [
        'https://sub.example.com/path',
        'https://sub.example.com/path',
        'https://sub.example.com/path',
      ],
      [
        'http://sub.example.com/path',
        'https://sub.example.com/path',
        'http://sub.example.com/path',
      ],
      ['sub.example.com/path', 'https://sub.example.com/path', 'sub.example.com/path'],
    ];

    test.each(cases)(
      'renders website link correctly for %s',
      (input, expectedHref, expectedLabel) => {
        render(
          <CommsLink
            contact={{ website: input } as Omit<ContactInformation, 'address'>}
            mode="website"
          />,
        );

        const link = screen.getByRole('link');
        expect(link.getAttribute('href')).toBe(expectedHref);
        expect(link.getAttribute('target')).toBe('_blank');
        expect(link.getAttribute('rel')).toBe('noopener noreferrer');

        const iconLabel = screen.getByTestId('icon-label');
        expect(iconLabel).toHaveTextContent(expectedLabel);
        expect(iconLabel.getAttribute('data-icon')).toBe('launch');
      },
    );

    test('renders website link with custom label and icon', () => {
      render(
        <CommsLink
          contact={{ website: 'https://example.com' } as Omit<ContactInformation, 'address'>}
          mode="website"
          label="Custom Website"
          icon="custom-icon"
        />,
      );

      const link = screen.getByRole('link');
      expect(link.getAttribute('href')).toBe('https://example.com');
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');

      const iconLabel = screen.getByTestId('icon-label');
      expect(iconLabel).toHaveTextContent('Custom Website');
      expect(iconLabel.getAttribute('data-icon')).toBe('custom-icon');
    });
  });

  describe('hideIcon prop', () => {
    test('renders link without icon when hideIcon is true', () => {
      render(
        <CommsLink
          contact={{ email: 'test@example.com' } as Omit<ContactInformation, 'address'>}
          mode="email"
          hideIcon
        />,
      );

      const link = screen.getByRole('link');
      expect(link).toHaveTextContent('test@example.com');
      expect(link).toHaveAttribute('aria-label', 'Email: test@example.com');
      // Icon should not be present
      expect(screen.queryByTestId('icon-label')).not.toBeInTheDocument();
    });

    test('renders link with icon by default', () => {
      render(
        <CommsLink
          contact={{ email: 'test@example.com' } as Omit<ContactInformation, 'address'>}
          mode="email"
        />,
      );

      // Icon should be present
      expect(screen.getByTestId('icon-label')).toBeInTheDocument();
    });
  });
});
