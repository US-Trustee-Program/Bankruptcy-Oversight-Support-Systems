import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import useFeatureFlags, {
  isFlagEnabled,
  PRIVILEGED_IDENTITY_MANAGEMENT,
} from '@/lib/hooks/UseFeatureFlags';

export enum AdminNavState {
  UNKNOWN,
  PRIVILEGED_IDENTITY,
  BANKRUPTCY_SOFTWARE,
  CASE_RELOAD,
  BANKS,
  NOTIFICATION_ROUTING,
  OFFICE_DIVISION_SETUP,
  PERMISSIONS,
  TRUSTEE_TASK_REGIONS,
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

  function handleNavPermissions() {
    setActiveNav(AdminNavState.PERMISSIONS);
  }

  function handleNavTrusteeTaskRegions() {
    setActiveNav(AdminNavState.TRUSTEE_TASK_REGIONS);
  }

  function handleNavOfficeDivisionSetup() {
    setActiveNav(AdminNavState.OFFICE_DIVISION_SETUP);
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
        {isFlagEnabled(flags, PRIVILEGED_IDENTITY_MANAGEMENT) && (
          <li className="usa-sidenav__item">
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
          </li>
        )}
        <li className="usa-sidenav__item">
          <NavLink
            to="/admin/permissions"
            data-testid="permissions-nav-link"
            className={'usa-nav-link ' + setCurrentAdminNav(activeNav, AdminNavState.PERMISSIONS)}
            onClick={handleNavPermissions}
            title="Manage permissions"
          >
            Permissions
          </NavLink>
        </li>
        <li className="usa-sidenav__item">
          <NavLink
            to="/admin/trustee-task-regions"
            data-testid="trustee-task-regions-nav-link"
            className={
              'usa-nav-link ' + setCurrentAdminNav(activeNav, AdminNavState.TRUSTEE_TASK_REGIONS)
            }
            onClick={handleNavTrusteeTaskRegions}
            title="Manage trustee task regions"
          >
            Trustee Task Regions
          </NavLink>
        </li>
        <li className="usa-sidenav__item">
          <NavLink
            to="/admin/office-division-setup"
            data-testid="office-division-setup-nav-link"
            className={
              'usa-nav-link ' + setCurrentAdminNav(activeNav, AdminNavState.OFFICE_DIVISION_SETUP)
            }
            onClick={handleNavOfficeDivisionSetup}
            title="Manage which court divisions each office oversees"
          >
            Office &amp; Division Setup
          </NavLink>
        </li>
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
      </ul>
    </nav>
  );
}

export default AdminScreenNavigation;
