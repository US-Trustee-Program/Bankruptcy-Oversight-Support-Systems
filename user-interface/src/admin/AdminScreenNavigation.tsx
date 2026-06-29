import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import useFeatureFlags, {
  PRIVILEGED_IDENTITY_MANAGEMENT,
  TRUSTEE_SOFTWARE_BANK_DISPLAY,
} from '@/lib/hooks/UseFeatureFlags';

export enum AdminNavState {
  UNKNOWN,
  PRIVILEGED_IDENTITY,
  BANKRUPTCY_SOFTWARE,
  CASE_RELOAD,
  BANKS,
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

  return (
    <nav className={`admin-screen-navigation`} aria-label="Admin Side navigation" role="navigation">
      <ul className="usa-sidenav">
        <li className="usa-sidenav__item">
          {!!flags[PRIVILEGED_IDENTITY_MANAGEMENT] && (
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
        {!!flags[TRUSTEE_SOFTWARE_BANK_DISPLAY] && (
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
        {!!flags[TRUSTEE_SOFTWARE_BANK_DISPLAY] && (
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
      </ul>
    </nav>
  );
}

export default AdminScreenNavigation;
