import { useState } from 'react';
import { Link } from 'react-router-dom';

export function mapNavState(path: string) {
  const cleanPath = path.replace(/\/$/, '').split('/');
  switch (cleanPath[cleanPath.length - 1]) {
    case 'court-docket':
      return NavState.COURT_DOCKET;
    case 'audit-history':
      return NavState.AUDIT_HISTORY;
    case 'associated-cases':
      return NavState.ASSOCIATED_CASES;
    default:
      return NavState.CASE_OVERVIEW;
  }
}

export interface CaseDetailNavigationProps {
  caseId: string | undefined;
  showAssociatedCasesList: boolean;
  initiallySelectedNavLink: NavState;
  className?: string;
}

export enum NavState {
  CASE_OVERVIEW,
  COURT_DOCKET,
  AUDIT_HISTORY,
  ASSOCIATED_CASES,
}

export function setCurrentNav(activeNav: NavState, stateToCheck: NavState): string {
  return activeNav === stateToCheck ? 'usa-current' : '';
}

function CaseDetailNavigationComponent({
  caseId,
  showAssociatedCasesList,
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
              className={setCurrentNav(activeNav, NavState.CASE_OVERVIEW)}
              to={`/case-detail/${caseId}/`}
              onClick={() => setActiveNav(NavState.CASE_OVERVIEW)}
              data-testid="case-overview-link"
            >
              Case Overview
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
              Change History
            </Link>
          </li>
          {showAssociatedCasesList && (
            <li className="usa-sidenav__item">
              <Link
                className={setCurrentNav(activeNav, NavState.ASSOCIATED_CASES)}
                to={`/case-detail/${caseId}/associated-cases`}
                onClick={() => {
                  return setActiveNav(NavState.ASSOCIATED_CASES);
                }}
                data-testid="associated-cases-link"
              >
                Associated Cases
              </Link>
            </li>
          )}
        </ul>
      </nav>
    </>
  );
}

// const CaseDetailNavigation = forwardRef(CaseDetailNavigationComponent);

// export default CaseDetailNavigation;
export default CaseDetailNavigationComponent;
