import { NavLink } from 'react-router-dom';

interface BankruptcySoftwareDetailNavigationProps {
  softwareId: string;
}

export function BankruptcySoftwareDetailNavigation({
  softwareId,
}: Readonly<BankruptcySoftwareDetailNavigationProps>) {
  return (
    <nav aria-label="Bankruptcy software detail navigation">
      <ul className="usa-sidenav">
        <li className="usa-sidenav__item">
          <NavLink
            to={`/admin/bankruptcy-software/${softwareId}/overview`}
            data-testid="software-overview-nav-link"
            className={({ isActive }) =>
              'usa-sidenav__link' + (isActive ? ' usa-current current' : '')
            }
            title="Software vendor overview"
          >
            Overview
          </NavLink>
        </li>
        <li className="usa-sidenav__item">
          <span className="usa-sidenav__link" data-testid="software-trustees-nav-item">
            Trustees
          </span>
        </li>
      </ul>
    </nav>
  );
}
