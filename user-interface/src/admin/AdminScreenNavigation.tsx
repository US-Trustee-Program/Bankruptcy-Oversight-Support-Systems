import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import useFeatureFlags, {
  isFlagEnabled,
  TRUSTEE_CHANGE_NOTIFICATIONS,
  PRIVILEGED_IDENTITY_MANAGEMENT,
  TRUSTEE_SOFTWARE_BANK_DISPLAY,
} from '@/lib/hooks/UseFeatureFlags';

export enum AdminNavState {
  UNKNOWN,
  PRIVILEGED_IDENTITY,
  BANKRUPTCY_SOFTWARE,
  CASE_RELOAD,
  BANKS,
  NOTIFICATION_ROUTING,
}

function setCurrentAdminNav(activeNav: AdminNavState, stateToCheck: AdminNavState): string {
  return activeNav === stateToCheck ? 'usa-current current' : '';
}

interface AdminScreenNavigationProps {
  initiallySelectedNavLink: AdminNavState;
}

function AdminScreenNavigation(props: Readonly<AdminScreenNavigationProps>) {
  const { initiallySelectedNavLink } = props;
  const [activeNav, setActiveNav] = useState<AdminNavState>(initiallySelectedNavLink);
  const flags = useFeatureFlags();

  function handleNavPrivilegedIdentity() {
    setActiveNav(AdminNavState.PRIVILEGED_IDENTITY);
  }

  function handleNavBankruptcySoftware() {
    setActiveNav(AdminNavState.BANKRUPTCY_SOFTWARE);
  }

  function handleNavBanks() {
    setActiveNav(AdminNavState.BANKS);
  }

  function handleNavCaseReload() {
    setActiveNav(AdminNavState.CASE_RELOAD);
  }

  function handleNavNotificationRouting() {
    setActiveNav(AdminNavState.NOTIFICATION_ROUTING);
  }

  return (
    <nav className={`admin-screen-navigation`} aria-label="Admin Side navigation" role="navigation">
      <ul className="usa-sidenav">
        <li className="usa-sidenav__item">
          {isFlagEnabled(flags, PRIVILEGED_IDENTITY_MANAGEMENT) && (
            <NavLink
              to={`/admin/privileged-identity`}
              data-testid="privileged-identity-nav-link"
              className={
                'usa-nav-link ' + setCurrentAdminNav(activeNav, AdminNavState.PRIVILEGED_IDENTITY)
              }
              onClick={handleNavPrivilegedIdentity}
              title="Manage privileged identity"
            >
              Privileged Identity
            </NavLink>
          )}
        </li>
        {isFlagEnabled(flags, TRUSTEE_SOFTWARE_BANK_DISPLAY) && (
          <li className="usa-sidenav__item">
            <NavLink
              to={`/admin/bankruptcy-software`}
              data-testid="bankruptcy-software-nav-link"
              className={
                'usa-nav-link ' + setCurrentAdminNav(activeNav, AdminNavState.BANKRUPTCY_SOFTWARE)
              }
              onClick={handleNavBankruptcySoftware}
              title="Manage bankruptcy software"
            >
              Bankruptcy Software
            </NavLink>
          </li>
        )}
        {isFlagEnabled(flags, TRUSTEE_SOFTWARE_BANK_DISPLAY) && (
          <li className="usa-sidenav__item">
            <NavLink
              to="/admin/banks"
              data-testid="banks-nav-link"
              className={'usa-nav-link ' + setCurrentAdminNav(activeNav, AdminNavState.BANKS)}
              onClick={handleNavBanks}
              title="Manage banks"
            >
              Banks
            </NavLink>
          </li>
        )}
        <li className="usa-sidenav__item">
          <NavLink
            to="/admin/case-reload"
            data-testid="case-reload-nav-link"
            className={'usa-nav-link ' + setCurrentAdminNav(activeNav, AdminNavState.CASE_RELOAD)}
            onClick={handleNavCaseReload}
            title="Manually reload cases from DXTR"
          >
            Reload Case
          </NavLink>
        </li>
        {!!flags[TRUSTEE_CHANGE_NOTIFICATIONS] && (
          <li className="usa-sidenav__item">
            <NavLink
              to="/admin/notification-routing"
              data-testid="notification-routing-nav-link"
              className={
                'usa-nav-link ' + setCurrentAdminNav(activeNav, AdminNavState.NOTIFICATION_ROUTING)
              }
              onClick={handleNavNotificationRouting}
              title="Manage notification routing"
            >
              Notification Routing
            </NavLink>
          </li>
        )}
      </ul>
    </nav>
  );
}

export default AdminScreenNavigation;
