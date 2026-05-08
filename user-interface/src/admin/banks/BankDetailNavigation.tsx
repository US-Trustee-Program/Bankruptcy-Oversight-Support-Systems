import { NavLink } from 'react-router-dom';

interface BankDetailNavigationProps {
  bankId: string;
}

export function BankDetailNavigation({ bankId }: Readonly<BankDetailNavigationProps>) {
  return (
    <nav aria-label="Bank detail navigation" role="navigation">
      <ul className="usa-sidenav">
        <li className="usa-sidenav__item">
          <NavLink
            to={`/admin/banks/${bankId}/overview`}
            data-testid="bank-overview-nav-link"
            className={({ isActive }) =>
              'usa-sidenav__link' + (isActive ? ' usa-current current' : '')
            }
            title="Bank overview"
          >
            Overview
          </NavLink>
        </li>
      </ul>
    </nav>
  );
}
