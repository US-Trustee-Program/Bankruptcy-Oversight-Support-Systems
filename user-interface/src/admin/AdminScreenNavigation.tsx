import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import useFeatureFlags, {
  CAMS_ROLE_ASSIGNMENTS,
  isFlagEnabled,
  PRIVILEGED_IDENTITY_MANAGEMENT,
} from '@/lib/hooks/UseFeatureFlags';

export enum AdminNavState {
  UNKNOWN,
  PRIVILEGED_IDENTITY,
  TRUSTEE_TASK_REGIONS,
  BANKRUPTCY_SOFTWARE,
  CASE_RELOAD,
  BANKS,
  NOTIFICATION_ROUTING,
  PERMISSIONS,
  TRUSTEE_DATA_REPORT,
}

function setCurrentAdminNav(activeNav: AdminNavState, stateToCheck: AdminNavState): string {
  return activeNav === stateToCheck ? 'usa-current current' : '';
}

type AdminNavItem = {
  state: AdminNavState;
  to: string;
  testId: string;
  title: string;
  label: string;
  // Shown only when this feature flag is on.
  flag?: string;
};

const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  {
    state: AdminNavState.PRIVILEGED_IDENTITY,
    to: '/admin/privileged-identity',
    testId: 'privileged-identity-nav-link',
    title: 'Manage privileged identity',
    label: 'Privileged Identity',
    flag: PRIVILEGED_IDENTITY_MANAGEMENT,
  },
  {
    state: AdminNavState.PERMISSIONS,
    to: '/admin/permissions',
    testId: 'permissions-nav-link',
    title: 'Manage CAMS user permissions',
    label: 'Permissions',
    flag: CAMS_ROLE_ASSIGNMENTS,
  },
  {
    state: AdminNavState.TRUSTEE_TASK_REGIONS,
    to: '/admin/trustee-task-regions',
    testId: 'trustee-task-regions-nav-link',
    title: 'Manage trustee task regions',
    label: 'Trustee Task Regions',
  },
  {
    state: AdminNavState.BANKRUPTCY_SOFTWARE,
    to: '/admin/bankruptcy-software',
    testId: 'bankruptcy-software-nav-link',
    title: 'Manage bankruptcy software',
    label: 'Bankruptcy Software',
  },
  {
    state: AdminNavState.BANKS,
    to: '/admin/banks',
    testId: 'banks-nav-link',
    title: 'Manage banks',
    label: 'Banks',
  },
  {
    state: AdminNavState.CASE_RELOAD,
    to: '/admin/case-reload',
    testId: 'case-reload-nav-link',
    title: 'Manually reload cases from DXTR',
    label: 'Reload Case',
  },
  {
    state: AdminNavState.NOTIFICATION_ROUTING,
    to: '/admin/notification-routing',
    testId: 'notification-routing-nav-link',
    title: 'Manage notification routing',
    label: 'Notification Routing',
  },
  {
    state: AdminNavState.TRUSTEE_DATA_REPORT,
    to: '/admin/trustee-data-report',
    testId: 'trustee-data-report-nav-link',
    title: 'Compare CAMS trustee data with TOD',
    label: 'Trustee Data Report',
  },
];

interface AdminScreenNavigationProps {
  initiallySelectedNavLink: AdminNavState;
}

function AdminScreenNavigation(props: Readonly<AdminScreenNavigationProps>) {
  const { initiallySelectedNavLink } = props;
  const [activeNav, setActiveNav] = useState<AdminNavState>(initiallySelectedNavLink);
  const flags = useFeatureFlags();

  return (
    <nav className={`admin-screen-navigation`} aria-label="Admin Side navigation" role="navigation">
      <ul className="usa-sidenav">
        {ADMIN_NAV_ITEMS.filter((item) => !item.flag || isFlagEnabled(flags, item.flag)).map(
          (item) => (
            <li className="usa-sidenav__item" key={item.state}>
              <NavLink
                to={item.to}
                data-testid={item.testId}
                className={'usa-nav-link ' + setCurrentAdminNav(activeNav, item.state)}
                onClick={() => setActiveNav(item.state)}
                title={item.title}
              >
                {item.label}
              </NavLink>
            </li>
          ),
        )}
      </ul>
    </nav>
  );
}

export default AdminScreenNavigation;
