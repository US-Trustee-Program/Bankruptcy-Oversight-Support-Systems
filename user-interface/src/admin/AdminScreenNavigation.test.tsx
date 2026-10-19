import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import AdminScreenNavigation, { AdminNavState } from './AdminScreenNavigation';
import * as FeatureFlags from '@/lib/hooks/UseFeatureFlags';
import { PRIVILEGED_IDENTITY_MANAGEMENT } from '@/lib/hooks/UseFeatureFlags';
import { testFeatureFlags } from '@common/feature-flags';

const NAV_LINKS = [
  {
    name: 'Privileged Identity',
    testId: 'privileged-identity-nav-link',
    href: '/admin/privileged-identity',
    navState: AdminNavState.PRIVILEGED_IDENTITY,
  },
  {
    name: 'Bankruptcy Software',
    testId: 'bankruptcy-software-nav-link',
    href: '/admin/bankruptcy-software',
    navState: AdminNavState.BANKRUPTCY_SOFTWARE,
  },
  {
    name: 'Banks',
    testId: 'banks-nav-link',
    href: '/admin/banks',
    navState: AdminNavState.BANKS,
  },
  {
    name: 'Reload Case',
    testId: 'case-reload-nav-link',
    href: '/admin/case-reload',
    navState: AdminNavState.CASE_RELOAD,
  },
  {
    name: 'Notification Routing',
    testId: 'notification-routing-nav-link',
    href: '/admin/notification-routing',
    navState: AdminNavState.NOTIFICATION_ROUTING,
  },
];

describe('Admin screen navigation tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(FeatureFlags, 'default').mockReturnValue(testFeatureFlags);
  });

  function renderNav(initialNavState: AdminNavState = AdminNavState.UNKNOWN) {
    render(
      <BrowserRouter>
        <AdminScreenNavigation initiallySelectedNavLink={initialNavState} />
      </BrowserRouter>,
    );
  }

  function expectOnlyCurrent(testId: string) {
    NAV_LINKS.forEach((link) => {
      const navLink = screen.getByTestId(link.testId);
      if (link.testId === testId) {
        expect(navLink).toHaveClass('usa-current');
      } else {
        expect(navLink).not.toHaveClass('usa-current');
      }
    });
  }

  test.each(NAV_LINKS)('should render the $name nav link', ({ name, testId, href }) => {
    renderNav();

    const navLink = screen.getByTestId(testId);
    expect(navLink).toHaveTextContent(name);
    expect(navLink).toHaveAttribute('href', href);
  });

  test.each(NAV_LINKS)(
    'should mark only the $name nav link current when it is initially selected',
    ({ testId, navState }) => {
      renderNav(navState);

      expectOnlyCurrent(testId);
    },
  );

  test.each(NAV_LINKS)(
    'should make the $name nav link the only current link when clicked',
    async ({ testId, navState }) => {
      const startingLink = NAV_LINKS.find((link) => link.navState !== navState)!;
      renderNav(startingLink.navState);

      await userEvent.click(screen.getByTestId(testId));

      expectOnlyCurrent(testId);
    },
  );

  test('should not mark any nav link current for UNKNOWN state', () => {
    renderNav(AdminNavState.UNKNOWN);

    NAV_LINKS.forEach((link) => {
      expect(screen.getByTestId(link.testId)).not.toHaveClass('usa-current');
    });
  });

  test('should not display Privileged Identity nav link when PRIVILEGED_IDENTITY_MANAGEMENT flag is false', () => {
    vi.spyOn(FeatureFlags, 'default').mockReturnValue({
      ...testFeatureFlags,
      [PRIVILEGED_IDENTITY_MANAGEMENT]: false,
    });

    renderNav();

    expect(screen.queryByTestId('privileged-identity-nav-link')).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(NAV_LINKS.length - 1);
  });
});
