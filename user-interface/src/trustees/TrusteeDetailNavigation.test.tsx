import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import TrusteeDetailNavigation, {
  TrusteeNavState,
  TrusteeDetailNavigationProps,
  mapTrusteeDetailNavState,
} from './TrusteeDetailNavigation';
import useFeatureFlags from '@/lib/hooks/UseFeatureFlags';
import { testFeatureFlags } from '@common/feature-flags';

vi.mock('@/lib/hooks/UseFeatureFlags');
const mockUseFeatureFlags = vi.mocked(useFeatureFlags);

describe('TrusteeDetailNavigation', () => {
  beforeEach(() => {
    mockUseFeatureFlags.mockReturnValue(testFeatureFlags);
  });

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
      text: 'Overview',
      href: '/trustees/12345',
      title: 'View basic details about the current trustee',
      state: TrusteeNavState.TRUSTEE_PROFILE,
    },
    {
      testId: 'trustee-appointments-nav-link',
      text: 'Appointments',
      href: '/trustees/12345/appointments',
      title: 'View appointments for the current trustee',
      state: TrusteeNavState.APPOINTMENTS,
    },
    {
      testId: 'trustee-assigned-staff-nav-link',
      text: 'Assigned Staff',
      href: '/trustees/12345/assigned-staff',
      title: 'View staff assigned to the current trustee',
      state: TrusteeNavState.ASSIGNED_STAFF,
    },
    {
      testId: 'trustee-notes-nav-link',
      text: 'Trustee Notes',
      href: '/trustees/12345/notes',
      title: 'View notes for the trustee',
      state: TrusteeNavState.NOTES,
    },
    {
      testId: 'trustee-audit-history-nav-link',
      text: 'Change History',
      href: '/trustees/12345/audit-history',
      title: 'View audit history for the trustee',
      state: TrusteeNavState.AUDIT_HISTORY,
    },
    {
      testId: 'trustee-case-list-nav-link',
      text: 'Case List',
      href: '/trustees/12345/cases',
      title: 'View cases for the current trustee',
      state: TrusteeNavState.CASE_LIST,
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

  test('should apply active CSS class to audit history link when initially selected', () => {
    renderWithRouter({
      ...defaultProps,
      initiallySelectedNavLink: TrusteeNavState.AUDIT_HISTORY,
    });

    const auditLink = screen.getByTestId('trustee-audit-history-nav-link');
    expect(auditLink.className).toContain('usa-current');

    const profileLink = screen.getByTestId('trustee-profile-nav-link');
    expect(profileLink.className).not.toContain('usa-current');
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

  test.each(navigationLinks)(
    'clicking $testId applies active CSS class to that link',
    ({ testId }) => {
      renderWithRouter(defaultProps);
      const link = screen.getByTestId(testId);
      fireEvent.click(link);
      expect(link.className).toContain('usa-current');
    },
  );

  test('should have proper CSS classes on navigation elements', () => {
    renderWithRouter(defaultProps);

    expect(screen.getByRole('list')).toHaveClass('usa-sidenav');

    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(6);
    listItems.forEach((item) => {
      expect(item).toHaveClass('usa-sidenav__item');
    });

    const links = screen.getAllByRole('link');
    links.forEach((link) => {
      expect(link).toHaveClass('usa-sidenav__link');
    });
  });

  describe('trustee-assigned-staff-enabled flag is enabled', () => {
    test('should show Assigned Staff nav link', () => {
      renderWithRouter(defaultProps);

      expect(screen.getByTestId('trustee-assigned-staff-nav-link')).toBeInTheDocument();
      expect(screen.getByText('Assigned Staff')).toBeInTheDocument();
    });

    test('should render 6 nav items', () => {
      renderWithRouter(defaultProps);

      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(6);
    });
  });

  describe('trustee-assigned-staff-enabled flag is disabled', () => {
    beforeEach(() => {
      mockUseFeatureFlags.mockReturnValue({
        ...testFeatureFlags,
        'trustee-assigned-staff-enabled': false,
      });
    });

    test('should not show Assigned Staff nav link', () => {
      renderWithRouter(defaultProps);

      expect(screen.queryByTestId('trustee-assigned-staff-nav-link')).not.toBeInTheDocument();
      expect(screen.queryByText('Assigned Staff')).not.toBeInTheDocument();
    });

    test('should render 5 nav items', () => {
      renderWithRouter(defaultProps);

      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(5);
    });

    test('should still show all other nav links', () => {
      renderWithRouter(defaultProps);

      expect(screen.getByTestId('trustee-profile-nav-link')).toBeInTheDocument();
      expect(screen.getByTestId('trustee-appointments-nav-link')).toBeInTheDocument();
      expect(screen.getByTestId('trustee-notes-nav-link')).toBeInTheDocument();
      expect(screen.getByTestId('trustee-audit-history-nav-link')).toBeInTheDocument();
    });
  });

  describe('trustee-case-list flag is enabled', () => {
    test('should show Case List nav link', () => {
      renderWithRouter(defaultProps);

      expect(screen.getByTestId('trustee-case-list-nav-link')).toBeInTheDocument();
      expect(screen.getByText('Case List')).toBeInTheDocument();
    });

    test('should link to /trustees/:id/cases', () => {
      renderWithRouter(defaultProps);

      const link = screen.getByTestId('trustee-case-list-nav-link');
      expect(link).toHaveAttribute('href', '/trustees/12345/cases');
    });
  });

  describe('trustee-case-list flag is disabled', () => {
    beforeEach(() => {
      mockUseFeatureFlags.mockReturnValue({
        ...testFeatureFlags,
        'trustee-case-list': false,
      });
    });

    test('should not show Case List nav link', () => {
      renderWithRouter(defaultProps);

      expect(screen.queryByTestId('trustee-case-list-nav-link')).not.toBeInTheDocument();
      expect(screen.queryByText('Case List')).not.toBeInTheDocument();
    });

    test('should render 5 nav items when only case-list flag is off', () => {
      renderWithRouter(defaultProps);

      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(5);
    });
  });
});

describe('mapTrusteeDetailNavState', () => {
  test.each([
    ['appointments', TrusteeNavState.APPOINTMENTS],
    ['audit-history', TrusteeNavState.AUDIT_HISTORY],
    ['/trustees/12345/assigned-staff', TrusteeNavState.ASSIGNED_STAFF],
    ['notes', TrusteeNavState.NOTES],
    ['cases', TrusteeNavState.CASE_LIST],
    ['unknown-value', TrusteeNavState.TRUSTEE_PROFILE],
    ['', TrusteeNavState.TRUSTEE_PROFILE],
    [undefined as unknown as string, TrusteeNavState.TRUSTEE_PROFILE],
  ])('should map "%s" to %s', (input, expected) => {
    const result = mapTrusteeDetailNavState(input);
    expect(result).toBe(expected);
  });
});

describe('TrusteeNavState enum', () => {
  test('should have exactly six enum values for navigation states', () => {
    expect(TrusteeNavState.TRUSTEE_PROFILE).toBeDefined();
    expect(TrusteeNavState.APPOINTMENTS).toBeDefined();
    expect(TrusteeNavState.ASSIGNED_STAFF).toBeDefined();
    expect(TrusteeNavState.NOTES).toBeDefined();
    expect(TrusteeNavState.AUDIT_HISTORY).toBeDefined();
    expect(TrusteeNavState.CASE_LIST).toBeDefined();

    const enumValues = Object.values(TrusteeNavState).filter((value) => typeof value === 'number');
    expect(enumValues).toHaveLength(6);
  });
});
