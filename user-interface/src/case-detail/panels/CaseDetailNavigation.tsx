import { useState } from 'react';
import { Link } from 'react-router-dom';

export function mapNavState(path: string) {
  const cleanPath = path.replace(/\/$/, '').split('/');
  switch (cleanPath[cleanPath.length - 1]) {
    case 'court-docket':
      return NavState.COURT_DOCKET;
    case 'audit-history':
      return NavState.AUDIT_HISTORY;
    default:
      return NavState.BASIC_INFO;
  }
}

export interface CaseDetailNavigationProps {
  caseId: string | undefined;
  initiallySelectedNavLink: NavState;
  className?: string;
}

export enum NavState {
  BASIC_INFO,
  COURT_DOCKET,
  AUDIT_HISTORY,
}

export function setCurrentNav(activeNav: NavState, stateToCheck: NavState): string {
  return activeNav === stateToCheck ? 'usa-current' : '';
}

function CaseDetailNavigationComponent({
  caseId,
  initiallySelectedNavLink,
  className,
}: CaseDetailNavigationProps) {
  const [activeNav, setActiveNav] = useState<NavState>(initiallySelectedNavLink);

  return (
    <>
      <nav className={`case-details-navigation ${className ?? ''}`} aria-label="Side navigation">
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
              onClick={() => {
                return setActiveNav(NavState.COURT_DOCKET);
              }}
              data-testid="court-docket-link"
            >
              Court Docket
            </Link>
          </li>
          <li className="usa-sidenav__item">
            <Link
              className={setCurrentNav(activeNav, NavState.AUDIT_HISTORY)}
              to={`/case-detail/${caseId}/audit-history`}
              onClick={() => {
                return setActiveNav(NavState.AUDIT_HISTORY);
              }}
              data-testid="audit-history-link"
            >
              Audit History
            </Link>
          </li>
        </ul>
      </nav>
    </>
  );
}

// const CaseDetailNavigation = forwardRef(CaseDetailNavigationComponent);

// export default CaseDetailNavigation;
export default CaseDetailNavigationComponent;
