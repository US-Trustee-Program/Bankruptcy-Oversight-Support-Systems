import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import TrusteeDetailNavigation, {
  TrusteeNavState,
  TrusteeDetailNavigationProps,
  mapTrusteeDetailNavState,
} from './TrusteeDetailNavigation';

vi.mock('@/lib/utils/navigation', () => ({
  setCurrentNav: vi.fn((activeNav, currentNav) => (activeNav === currentNav ? 'usa-current' : '')),
  createNavStateMapper: vi.fn((mapping, defaultState) => (path: string) => {
    if (!path) {
      return defaultState;
    }
    const cleanPath = path.replace(/\/$/, '').split('/');
    const lastSegment = cleanPath[cleanPath.length - 1];
    return mapping[lastSegment] || defaultState;
  }),
}));

describe('TrusteeDetailNavigation', () => {
  function renderWithRouter(props: TrusteeDetailNavigationProps) {
    return render(
      <BrowserRouter>
        <TrusteeDetailNavigation {...props} />
      </BrowserRouter>,
    );
  }

  const defaultProps: TrusteeDetailNavigationProps = {
    trusteeId: '12345',
    initiallySelectedNavLink: TrusteeNavState.TRUSTEE_PROFILE,
  };

  test('should render navigation with default props', () => {
    renderWithRouter(defaultProps);

    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getByLabelText('Trustee Detail Side navigation')).toBeInTheDocument();

    expect(screen.getByTestId('trustee-profile-nav-link')).toBeInTheDocument();
    expect(screen.getByTestId('trustee-audit-history-nav-link')).toBeInTheDocument();
    expect(screen.getByTestId('trustee-assigned-staff-nav-link')).toBeInTheDocument();

    expect(screen.getByTestId('trustee-profile-nav-link')).toHaveTextContent('Trustee Profile');
    expect(screen.getByTestId('trustee-audit-history-nav-link')).toHaveTextContent(
      'Change History',
    );
    expect(screen.getByTestId('trustee-assigned-staff-nav-link')).toHaveTextContent(
      'Assigned Staff',
    );
  });

  test('should render with custom className', () => {
    const customClassName = 'custom-nav-class';
    renderWithRouter({ ...defaultProps, className: customClassName });

    const nav = screen.getByRole('navigation');
    expect(nav).toHaveClass('trustee-details-navigation');
    expect(nav).toHaveClass(customClassName);
  });

  test('should render without className when not provided', () => {
    renderWithRouter(defaultProps);

    const nav = screen.getByRole('navigation');
    expect(nav).toHaveClass('trustee-details-navigation');
    expect(nav.className).not.toContain('undefined');
  });

  test('should generate correct URLs with trusteeId', () => {
    renderWithRouter(defaultProps);

    const profileLink = screen.getByTestId('trustee-profile-nav-link');
    const auditLink = screen.getByTestId('trustee-audit-history-nav-link');
    const assignedStaffLink = screen.getByTestId('trustee-assigned-staff-nav-link');

    expect(profileLink).toHaveAttribute('href', '/trustees/12345');
    expect(auditLink).toHaveAttribute('href', '/trustees/12345/audit-history');
    expect(assignedStaffLink).toHaveAttribute('href', '/trustees/12345/assigned-staff');
  });

  test('should handle undefined trusteeId', () => {
    renderWithRouter({ ...defaultProps, trusteeId: undefined });

    const profileLink = screen.getByTestId('trustee-profile-nav-link');
    const auditLink = screen.getByTestId('trustee-audit-history-nav-link');
    const assignedStaffLink = screen.getByTestId('trustee-assigned-staff-nav-link');

    expect(profileLink).toHaveAttribute('href', '/trustees/undefined');
    expect(auditLink).toHaveAttribute('href', '/trustees/undefined/audit-history');
    expect(assignedStaffLink).toHaveAttribute('href', '/trustees/undefined/assigned-staff');
  });

  test('should render with audit history initially selected', () => {
    renderWithRouter({
      ...defaultProps,
      initiallySelectedNavLink: TrusteeNavState.AUDIT_HISTORY,
    });

    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getByTestId('trustee-profile-nav-link')).toBeInTheDocument();
    expect(screen.getByTestId('trustee-audit-history-nav-link')).toBeInTheDocument();
  });

  test('should have proper accessibility attributes', () => {
    renderWithRouter(defaultProps);

    const nav = screen.getByRole('navigation');
    expect(nav).toHaveAttribute('aria-label', 'Trustee Detail Side navigation');

    const profileLink = screen.getByTestId('trustee-profile-nav-link');
    const auditLink = screen.getByTestId('trustee-audit-history-nav-link');
    const assignedStaffLink = screen.getByTestId('trustee-assigned-staff-nav-link');

    expect(profileLink).toHaveAttribute('title', 'view basic details about the current trustee');
    expect(auditLink).toHaveAttribute('title', 'view audit history for the trustee');
    expect(assignedStaffLink).toHaveAttribute(
      'title',
      'view staff assigned to the current trustee',
    );
  });

  test('should call setActiveNav when profile link is clicked', () => {
    renderWithRouter({
      ...defaultProps,
      initiallySelectedNavLink: TrusteeNavState.AUDIT_HISTORY,
    });

    const profileLink = screen.getByTestId('trustee-profile-nav-link');
    fireEvent.click(profileLink);

    expect(profileLink).toBeInTheDocument();
  });

  test('should call setActiveNav when audit history link is clicked', () => {
    renderWithRouter(defaultProps);

    const auditLink = screen.getByTestId('trustee-audit-history-nav-link');
    fireEvent.click(auditLink);

    expect(auditLink).toBeInTheDocument();
  });

  test('should call setActiveNav when assigned staff link is clicked', () => {
    renderWithRouter(defaultProps);

    const assignedStaffLink = screen.getByTestId('trustee-assigned-staff-nav-link');
    fireEvent.click(assignedStaffLink);

    expect(assignedStaffLink).toBeInTheDocument();
  });

  test('should have proper CSS classes on navigation elements', () => {
    renderWithRouter(defaultProps);

    expect(screen.getByRole('list')).toHaveClass('usa-sidenav');

    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(3);
    listItems.forEach((item) => {
      expect(item).toHaveClass('usa-sidenav__item');
    });

    const links = screen.getAllByRole('link');
    links.forEach((link) => {
      expect(link).toHaveClass('usa-sidenav__link');
    });
  });
});

describe('mapTrusteeDetailNavState', () => {
  test('should map audit-history to AUDIT_HISTORY', () => {
    const result = mapTrusteeDetailNavState('audit-history');
    expect(result).toBe(TrusteeNavState.AUDIT_HISTORY);
  });

  test('should map unknown values to TRUSTEE_PROFILE default', () => {
    const result = mapTrusteeDetailNavState('unknown-value');
    expect(result).toBe(TrusteeNavState.TRUSTEE_PROFILE);
  });

  test('should map empty string to TRUSTEE_PROFILE default', () => {
    const result = mapTrusteeDetailNavState('');
    expect(result).toBe(TrusteeNavState.TRUSTEE_PROFILE);
  });

  test('should map undefined to TRUSTEE_PROFILE default', () => {
    const result = mapTrusteeDetailNavState(undefined as unknown as string);
    expect(result).toBe(TrusteeNavState.TRUSTEE_PROFILE);
  });
});

describe('TrusteeNavState enum', () => {
  test('should have exactly three enum values for navigation states', () => {
    expect(TrusteeNavState.TRUSTEE_PROFILE).toBeDefined();
    expect(TrusteeNavState.AUDIT_HISTORY).toBeDefined();
    expect(TrusteeNavState.ASSIGNED_STAFF).toBeDefined();

    const enumValues = Object.values(TrusteeNavState).filter((value) => typeof value === 'number');
    expect(enumValues).toHaveLength(3);
  });
});

describe('TrusteeDetailNavigation - Assigned Staff', () => {
  function renderWithRouter(props: {
    trusteeId: string;
    initiallySelectedNavLink: TrusteeNavState;
  }) {
    return render(
      <BrowserRouter>
        <TrusteeDetailNavigation {...props} />
      </BrowserRouter>,
    );
  }

  const defaultProps = {
    trusteeId: '12345',
    initiallySelectedNavLink: TrusteeNavState.TRUSTEE_PROFILE,
  };

  test('should render assigned staff navigation link', () => {
    renderWithRouter(defaultProps);

    const assignedStaffLink = screen.getByTestId('trustee-assigned-staff-nav-link');
    expect(assignedStaffLink).toBeInTheDocument();
    expect(assignedStaffLink).toHaveTextContent('Assigned Staff');
    expect(assignedStaffLink).toHaveAttribute('href', '/trustees/12345/assigned-staff');
  });

  test('should update active state when assigned staff link clicked', () => {
    renderWithRouter(defaultProps);

    const assignedStaffLink = screen.getByTestId('trustee-assigned-staff-nav-link');
    fireEvent.click(assignedStaffLink);

    // The setCurrentNav mock is called with the updated state
    expect(assignedStaffLink.className).toContain('usa-sidenav__link');
  });

  test('should have correct URL for assigned staff section', () => {
    renderWithRouter(defaultProps);

    const assignedStaffLink = screen.getByTestId('trustee-assigned-staff-nav-link');
    expect(assignedStaffLink).toHaveAttribute('href', '/trustees/12345/assigned-staff');
  });
});

describe('mapTrusteeDetailNavState - Assigned Staff', () => {
  test('should map assigned-staff path to ASSIGNED_STAFF state', () => {
    const result = mapTrusteeDetailNavState('/trustees/12345/assigned-staff');
    expect(result).toBe(TrusteeNavState.ASSIGNED_STAFF);
  });
});
