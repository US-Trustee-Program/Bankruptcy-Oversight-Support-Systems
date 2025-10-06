import { useState } from 'react';
import { NavLink } from 'react-router-dom';

export enum AdminNavState {
  UNKNOWN,
  PRIVILEGED_IDENTITY,
  BANKRUPTCY_SOFTWARE,
}

export function setCurrentAdminNav(activeNav: AdminNavState, stateToCheck: AdminNavState): string {
  return activeNav === stateToCheck ? 'usa-current current' : '';
}

export interface AdminScreenNavigationProps {
  initiallySelectedNavLink: AdminNavState;
}

export function AdminScreenNavigation(props: Readonly<AdminScreenNavigationProps>) {
  const { initiallySelectedNavLink } = props;
  const [activeNav, setActiveNav] = useState<AdminNavState>(initiallySelectedNavLink);

  return (
    <nav className={`admin-screen-navigation`} aria-label="Admin Side navigation" role="navigation">
      <ul className="usa-sidenav">
        <li className="usa-sidenav__item">
          <NavLink
            to={`/admin/privileged-identity`}
            data-testid="privileged-identity-nav-link"
            className={
              'usa-nav-link ' + setCurrentAdminNav(activeNav, AdminNavState.PRIVILEGED_IDENTITY)
            }
            onClick={() => setActiveNav(AdminNavState.PRIVILEGED_IDENTITY)}
            title="manage privileged identity"
          >
            Privileged Identity
          </NavLink>
        </li>
        <li className="usa-sidenav__item">
          <NavLink
            to={`/admin/bankruptcy-software`}
            data-testid="bankruptcy-software-nav-link"
            className={
              'usa-nav-link ' + setCurrentAdminNav(activeNav, AdminNavState.BANKRUPTCY_SOFTWARE)
            }
            onClick={() => setActiveNav(AdminNavState.BANKRUPTCY_SOFTWARE)}
            title="manage bankruptcy software"
          >
            Bankruptcy Software
          </NavLink>
        </li>
      </ul>
    </nav>
  );
}

export default AdminScreenNavigation;
