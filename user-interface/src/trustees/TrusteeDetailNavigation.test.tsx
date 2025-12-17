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

  const navigationLinks = [
    {
      testId: 'trustee-profile-nav-link',
      text: 'Profile',
      href: '/trustees/12345',
      title: 'view basic details about the current trustee',
      state: TrusteeNavState.TRUSTEE_PROFILE,
    },
    {
      testId: 'trustee-appointments-nav-link',
      text: 'Appointments',
      href: '/trustees/12345/appointments',
      title: 'view appointments for the current trustee',
      state: TrusteeNavState.APPOINTMENTS,
    },
    {
      testId: 'trustee-assigned-staff-nav-link',
      text: 'Assigned Staff',
      href: '/trustees/12345/assigned-staff',
      title: 'view staff assigned to the current trustee',
      state: TrusteeNavState.ASSIGNED_STAFF,
    },
    {
      testId: 'trustee-audit-history-nav-link',
      text: 'Change History',
      href: '/trustees/12345/audit-history',
      title: 'view audit history for the trustee',
      state: TrusteeNavState.AUDIT_HISTORY,
    },
  ];

  test('should render navigation with default props', () => {
    renderWithRouter(defaultProps);

    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getByLabelText('Trustee Detail Side navigation')).toBeInTheDocument();

    navigationLinks.forEach(({ testId, text }) => {
      expect(screen.getByTestId(testId)).toBeInTheDocument();
      expect(screen.getByTestId(testId)).toHaveTextContent(text);
    });
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

  test.each(navigationLinks)('should generate correct URL for $testId', ({ testId, href }) => {
    renderWithRouter(defaultProps);
    const link = screen.getByTestId(testId);
    expect(link).toHaveAttribute('href', href);
  });

  test.each(navigationLinks)(
    'should handle undefined trusteeId for $testId',
    ({ testId, href }) => {
      renderWithRouter({ ...defaultProps, trusteeId: undefined });
      const link = screen.getByTestId(testId);
      const expectedHref = href.replace('12345', 'undefined');
      expect(link).toHaveAttribute('href', expectedHref);
    },
  );

  test('should render with audit history initially selected', () => {
    renderWithRouter({
      ...defaultProps,
      initiallySelectedNavLink: TrusteeNavState.AUDIT_HISTORY,
    });

    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getByTestId('trustee-profile-nav-link')).toBeInTheDocument();
    expect(screen.getByTestId('trustee-audit-history-nav-link')).toBeInTheDocument();
  });

  test.each(navigationLinks)(
    'should have proper accessibility attributes for $testId',
    ({ testId, title }) => {
      renderWithRouter(defaultProps);
      const nav = screen.getByRole('navigation');
      expect(nav).toHaveAttribute('aria-label', 'Trustee Detail Side navigation');

      const link = screen.getByTestId(testId);
      expect(link).toHaveAttribute('title', title);
    },
  );

  test.each(navigationLinks)('should handle click events for $testId', ({ testId }) => {
    renderWithRouter(defaultProps);
    const link = screen.getByTestId(testId);
    fireEvent.click(link);
    expect(link).toBeInTheDocument();
  });

  test('should have proper CSS classes on navigation elements', () => {
    renderWithRouter(defaultProps);

    expect(screen.getByRole('list')).toHaveClass('usa-sidenav');

    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(4);
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
  test.each([
    ['appointments', TrusteeNavState.APPOINTMENTS],
    ['audit-history', TrusteeNavState.AUDIT_HISTORY],
    ['/trustees/12345/assigned-staff', TrusteeNavState.ASSIGNED_STAFF],
    ['unknown-value', TrusteeNavState.TRUSTEE_PROFILE],
    ['', TrusteeNavState.TRUSTEE_PROFILE],
    [undefined as unknown as string, TrusteeNavState.TRUSTEE_PROFILE],
  ])('should map "%s" to %s', (input, expected) => {
    const result = mapTrusteeDetailNavState(input);
    expect(result).toBe(expected);
  });
});

describe('TrusteeNavState enum', () => {
  test('should have exactly four enum values for navigation states', () => {
    expect(TrusteeNavState.TRUSTEE_PROFILE).toBeDefined();
    expect(TrusteeNavState.APPOINTMENTS).toBeDefined();
    expect(TrusteeNavState.ASSIGNED_STAFF).toBeDefined();
    expect(TrusteeNavState.AUDIT_HISTORY).toBeDefined();

    const enumValues = Object.values(TrusteeNavState).filter((value) => typeof value === 'number');
    expect(enumValues).toHaveLength(4);
  });
});
