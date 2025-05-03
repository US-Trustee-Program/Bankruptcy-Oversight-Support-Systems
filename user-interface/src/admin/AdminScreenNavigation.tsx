import { useState } from 'react';
import { NavLink } from 'react-router-dom';

export enum AdminNavState {
  PRIVILEGED_IDENTITY,
  UNKNOWN,
}

export interface AdminScreenNavigationProps {
  initiallySelectedNavLink: AdminNavState;
}

export function AdminScreenNavigation(props: AdminScreenNavigationProps) {
  const { initiallySelectedNavLink } = props;
  const [activeNav, setActiveNav] = useState<AdminNavState>(initiallySelectedNavLink);

  return (
    <nav aria-label="Admin Side navigation" className={`admin-screen-navigation`} role="navigation">
      <ul className="usa-sidenav">
        <li className="usa-sidenav__item">
          <NavLink
            className={
              'usa-nav-link ' + setCurrentAdminNav(activeNav, AdminNavState.PRIVILEGED_IDENTITY)
            }
            data-testid="privileged-identity-nav-link"
            onClick={() => setActiveNav(AdminNavState.PRIVILEGED_IDENTITY)}
            title="manage privileged identity"
            to={`/admin/privileged-identity`}
          >
            Privileged Identity
          </NavLink>
        </li>
      </ul>
    </nav>
  );
}

export function setCurrentAdminNav(activeNav: AdminNavState, stateToCheck: AdminNavState): string {
  return activeNav === stateToCheck ? 'usa-current current' : '';
}

export default AdminScreenNavigation;
