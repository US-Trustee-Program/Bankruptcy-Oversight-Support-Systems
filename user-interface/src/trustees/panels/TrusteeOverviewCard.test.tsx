import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import TrusteeOverviewCard from './TrusteeOverviewCard';
import { Trustee } from '@common/cams/trustees';
import { vi } from 'vitest';

vi.mock('@/lib/hooks/UseApplicationInsights', () => ({
  getAppInsights: vi.fn().mockReturnValue({
    appInsights: {
      trackEvent: vi.fn(),
    },
  }),
}));

vi.mock('@/lib/utils/local-storage', () => ({
  default: {
    getSession: vi.fn().mockReturnValue({
      user: {
        roles: ['TrusteeAdmin'],
      },
    }),
  },
}));

const mockTrustee: Trustee = {
  id: 'test-trustee-id',
  trusteeId: 'test-trustee-id',
  name: 'John Doe',
  firstName: 'John',
  lastName: 'Doe',
  public: {
    address: {
      address1: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      countryCode: 'US',
    },
    phone: {
      number: '212-555-0100',
    },
    email: 'john.doe@example.com',
  },
  updatedOn: '2025-01-01T00:00:00.000Z',
  updatedBy: { id: 'test-user', name: 'Test User' },
};

describe('TrusteeOverviewCard', () => {
  function renderWithRouter(ui: React.ReactElement) {
    return render(<BrowserRouter>{ui}</BrowserRouter>);
  }

  describe('trusteeId prop', () => {
    test('should render trustee name as a link when trusteeId is provided', () => {
      renderWithRouter(<TrusteeOverviewCard trustee={mockTrustee} trusteeId="test-trustee-id" />);

      const link = screen.getByRole('link', { name: /view trustee profile for john doe/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', '/trustees/test-trustee-id');
    });

    test('should render trustee name as plain text when trusteeId is not provided', () => {
      renderWithRouter(<TrusteeOverviewCard trustee={mockTrustee} />);

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /view trustee profile/i })).not.toBeInTheDocument();
    });
  });

  describe('onEdit prop', () => {
    test('should render edit button when onEdit callback is provided', () => {
      const mockOnEdit = vi.fn();
      renderWithRouter(<TrusteeOverviewCard trustee={mockTrustee} onEdit={mockOnEdit} />);

      const editButton = screen.getByRole('button', { name: /edit trustee public overview/i });
      expect(editButton).toBeInTheDocument();
    });

    test('should not render edit button when onEdit is not provided', () => {
      renderWithRouter(<TrusteeOverviewCard trustee={mockTrustee} />);

      expect(
        screen.queryByRole('button', { name: /edit trustee public overview/i }),
      ).not.toBeInTheDocument();
    });

    test('should call onEdit when edit button is clicked', () => {
      const mockOnEdit = vi.fn();
      renderWithRouter(<TrusteeOverviewCard trustee={mockTrustee} onEdit={mockOnEdit} />);

      const editButton = screen.getByRole('button', { name: /edit trustee public overview/i });
      editButton.click();

      expect(mockOnEdit).toHaveBeenCalledTimes(1);
    });
  });

  describe('headerText prop', () => {
    test('should render default header text "Public" when not provided', () => {
      renderWithRouter(<TrusteeOverviewCard trustee={mockTrustee} />);

      expect(screen.getByRole('heading', { name: 'Public' })).toBeInTheDocument();
    });

    test('should render custom header text when provided', () => {
      renderWithRouter(
        <TrusteeOverviewCard trustee={mockTrustee} headerText="Public Contact Info" />,
      );

      expect(screen.getByRole('heading', { name: 'Public Contact Info' })).toBeInTheDocument();
    });

    test('should generate unique button IDs based on headerText', () => {
      const mockOnEdit = vi.fn();
      const { rerender } = renderWithRouter(
        <TrusteeOverviewCard
          trustee={mockTrustee}
          onEdit={mockOnEdit}
          headerText="Public"
          testIdPrefix="trustee"
        />,
      );

      let editButton = screen.getByRole('button', { name: /edit trustee public overview/i });
      expect(editButton).toHaveAttribute('id', 'edit-trustee-public-profile');

      rerender(
        <BrowserRouter>
          <TrusteeOverviewCard
            trustee={mockTrustee}
            onEdit={mockOnEdit}
            headerText="Public Contact Info"
            testIdPrefix="case-trustee"
          />
        </BrowserRouter>,
      );

      editButton = screen.getByRole('button', { name: /edit trustee public contact info/i });
      expect(editButton).toHaveAttribute('id', 'edit-case-trustee-public-contact-info-profile');
    });
  });

  describe('testIdPrefix prop', () => {
    test('should use default testIdPrefix "trustee" when not provided', () => {
      renderWithRouter(<TrusteeOverviewCard trustee={mockTrustee} />);

      // testIdPrefix is passed to FormattedContact, which uses it for test IDs
      // We can verify by checking if contact elements exist (they would have trustee-* IDs)
      expect(screen.getByText('123 Main St')).toBeInTheDocument();
      expect(screen.getByText('212-555-0100')).toBeInTheDocument();
    });

    test('should pass custom testIdPrefix to child components', () => {
      const mockOnEdit = vi.fn();
      renderWithRouter(
        <TrusteeOverviewCard
          trustee={mockTrustee}
          onEdit={mockOnEdit}
          testIdPrefix="case-trustee-public"
          headerText="Public Contact Info"
        />,
      );

      // Verify button ID uses custom prefix
      const editButton = screen.getByRole('button');
      expect(editButton).toHaveAttribute(
        'id',
        'edit-case-trustee-public-public-contact-info-profile',
      );
    });
  });

  describe('combined props', () => {
    test('should handle all props together correctly', () => {
      const mockOnEdit = vi.fn();
      renderWithRouter(
        <TrusteeOverviewCard
          trustee={mockTrustee}
          trusteeId="test-id"
          onEdit={mockOnEdit}
          headerText="Custom Header"
          testIdPrefix="custom-prefix"
        />,
      );

      // Header
      expect(screen.getByRole('heading', { name: 'Custom Header' })).toBeInTheDocument();

      // Clickable name
      expect(
        screen.getByRole('link', { name: /view trustee profile for john doe/i }),
      ).toBeInTheDocument();

      // Edit button with custom labels
      const editButton = screen.getByRole('button', { name: /edit trustee custom header/i });
      expect(editButton).toBeInTheDocument();
      expect(editButton).toHaveAttribute('id', 'edit-custom-prefix-custom-header-profile');

      // Contact info
      expect(screen.getByText('123 Main St')).toBeInTheDocument();
    });
  });
});
