import { useState } from 'react';
import { NavLink } from 'react-router-dom';

export function mapNavState(path: string) {
  const cleanPath = path.replace(/\/$/, '').split('/');
  switch (cleanPath[cleanPath.length - 1]) {
    case 'privileged-identity-management':
      return AdminNavState.PRIVILEGED_IDENTITY;
    default:
      return AdminNavState.PRIVILEGED_IDENTITY;
  }
}

export enum AdminNavState {
  PRIVILEGED_IDENTITY,
}

export function setCurrentAdminNav(activeNav: AdminNavState, stateToCheck: AdminNavState): string {
  return activeNav === stateToCheck ? 'usa-current current' : '';
}

export interface AdminScreenNavigationProps {
  initiallySelectedNavLink: AdminNavState;
}

export default function AdminScreenNavigation(props: AdminScreenNavigationProps) {
  const { initiallySelectedNavLink } = props;
  const [activeNav, setActiveNav] = useState<AdminNavState>(initiallySelectedNavLink);

  return (
    <>
      <nav
        className={`admin-screen-navigation`}
        aria-label="Admin Side navigation"
        role="navigation"
      >
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
        </ul>
      </nav>
    </>
  );
}
