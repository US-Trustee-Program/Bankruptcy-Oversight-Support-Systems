import useFeatureFlags, { CASE_NOTES_ENABLED } from '@/lib/hooks/UseFeatureFlags';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';

export function mapNavState(path: string) {
  const cleanPath = path.replace(/\/$/, '').split('/');
  switch (cleanPath[cleanPath.length - 1]) {
    case 'court-docket':
      return NavState.COURT_DOCKET;
    case 'audit-history':
      return NavState.AUDIT_HISTORY;
    case 'associated-cases':
      return NavState.ASSOCIATED_CASES;
    case 'notes':
      return NavState.CASE_NOTES;
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
  CASE_NOTES,
}

export function setCurrentNav(activeNav: NavState, stateToCheck: NavState): string {
  return activeNav === stateToCheck ? 'usa-current current' : '';
}

function CaseDetailNavigationComponent({
  caseId,
  showAssociatedCasesList,
  initiallySelectedNavLink,
  className,
}: CaseDetailNavigationProps) {
  const [activeNav, setActiveNav] = useState<NavState>(initiallySelectedNavLink);
  const featureFlags = useFeatureFlags();
  const caseNotesEnabledFlag = featureFlags[CASE_NOTES_ENABLED];

  return (
    <>
      <nav
        className={`case-details-navigation ${className ?? ''}`}
        aria-label="Case Detail Side navigation"
        role="navigation"
      >
        <ul className="usa-sidenav">
          <li className="usa-sidenav__item">
            <NavLink
              to={`/case-detail/${caseId}/`}
              data-testid="case-overview-link"
              className={'usa-nav-link ' + setCurrentNav(activeNav, NavState.CASE_OVERVIEW)}
              onClick={() => setActiveNav(NavState.CASE_OVERVIEW)}
              title="view basic details about the current case"
              end
            >
              Case Overview
            </NavLink>
          </li>
          <li className="usa-sidenav__item">
            <NavLink
              to={`/case-detail/${caseId}/court-docket`}
              data-testid="court-docket-link"
              className={'usa-nav-link ' + setCurrentNav(activeNav, NavState.COURT_DOCKET)}
              onClick={() => setActiveNav(NavState.COURT_DOCKET)}
              title="view court docket entries"
            >
              Court Docket
            </NavLink>
          </li>
          {caseNotesEnabledFlag && (
            <li className="usa-sidenav__item">
              <NavLink
                to={`/case-detail/${caseId}/notes`}
                data-testid="case-notes-link"
                className={'usa-nav-link ' + setCurrentNav(activeNav, NavState.CASE_NOTES)}
                onClick={() => setActiveNav(NavState.CASE_NOTES)}
                title="view case notes"
              >
                Case Notes
              </NavLink>
            </li>
          )}
          <li className="usa-sidenav__item">
            <NavLink
              to={`/case-detail/${caseId}/audit-history`}
              data-testid="audit-history-link"
              className={'usa-nav-link ' + setCurrentNav(activeNav, NavState.AUDIT_HISTORY)}
              onClick={() => setActiveNav(NavState.AUDIT_HISTORY)}
              title="view case audit history"
            >
              Change History
            </NavLink>
          </li>
          {showAssociatedCasesList && (
            <li className="usa-sidenav__item">
              <NavLink
                to={`/case-detail/${caseId}/associated-cases`}
                data-testid="associated-cases-link"
                className={'usa-nav-link ' + setCurrentNav(activeNav, NavState.ASSOCIATED_CASES)}
                onClick={() => setActiveNav(NavState.ASSOCIATED_CASES)}
                title="view associated cases"
              >
                Associated Cases
              </NavLink>
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
