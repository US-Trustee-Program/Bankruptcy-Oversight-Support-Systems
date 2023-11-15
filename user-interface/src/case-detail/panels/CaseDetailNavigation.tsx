import { useState } from 'react';
import { Link } from 'react-router-dom';

export interface CaseDetailNavigationProps {
  caseId: string | undefined;
}

export enum NavState {
  BASIC_INFO,
  COURT_DOCKET,
}

export function setCurrentNav(activeNav: NavState, stateToCheck: NavState): string {
  return activeNav === stateToCheck ? 'usa-current' : '';
}

export default function CaseDetailNavigation({ caseId }: CaseDetailNavigationProps) {
  const [activeNav, setActiveNav] = useState<NavState>(NavState.BASIC_INFO);

  return (
    <>
      <nav aria-label="Side navigation">
        <ul className="usa-sidenav">
          <li className="usa-sidenav__item">
            <Link
              className={setCurrentNav(activeNav, NavState.BASIC_INFO)}
              to={`/case-detail/${caseId}/`}
              onClick={() => setActiveNav(NavState.BASIC_INFO)}
              data-testid="basic-info-link"
            >
              Basic Information
            </Link>
          </li>
          <li className="usa-sidenav__item">
            <Link
              className={setCurrentNav(activeNav, NavState.COURT_DOCKET)}
              to={`/case-detail/${caseId}/court-docket`}
              onClick={() => setActiveNav(NavState.COURT_DOCKET)}
              data-testid="court-docket-link"
            >
              Court Docket
            </Link>
          </li>
        </ul>
      </nav>
    </>
  );
}
