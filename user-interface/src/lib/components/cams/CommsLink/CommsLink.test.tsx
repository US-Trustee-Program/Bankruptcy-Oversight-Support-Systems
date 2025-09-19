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
      expect(iconLabel.getAttribute('data-icon')).toBe('forum');
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
      expect(iconLabel).toHaveTextContent('555-123-4567 x123');
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

      const link = screen.getByRole('link');
      expect(link.getAttribute('href')).toBe('mailto:undefined');

      const iconLabel = screen.getByTestId('icon-label');
      expect(iconLabel).toHaveTextContent('Email');
      expect(iconLabel.getAttribute('data-icon')).toBe('mail');
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
});
