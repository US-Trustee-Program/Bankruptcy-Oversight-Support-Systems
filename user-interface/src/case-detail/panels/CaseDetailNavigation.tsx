import useFeatureFlags, { CASE_NOTES_ENABLED } from '@/lib/hooks/UseFeatureFlags';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';

export enum NavState {
  CASE_OVERVIEW,
  COURT_DOCKET,
  AUDIT_HISTORY,
  ASSOCIATED_CASES,
  CASE_NOTES,
}

export interface CaseDetailNavigationProps {
  caseId: string | undefined;
  className?: string;
  initiallySelectedNavLink: NavState;
  showAssociatedCasesList: boolean;
}

export default function CaseDetailNavigation({
  caseId,
  className,
  initiallySelectedNavLink,
  showAssociatedCasesList,
}: CaseDetailNavigationProps) {
  const [activeNav, setActiveNav] = useState<NavState>(initiallySelectedNavLink);
  const featureFlags = useFeatureFlags();
  const caseNotesEnabledFlag = featureFlags[CASE_NOTES_ENABLED];

  return (
    <>
      <nav
        aria-label="Case Detail Side navigation"
        className={`case-details-navigation ${className ?? ''}`}
        role="navigation"
      >
        <ul className="usa-sidenav">
          <li className="usa-sidenav__item">
            <NavLink
              className={'usa-nav-link ' + setCurrentNav(activeNav, NavState.CASE_OVERVIEW)}
              data-testid="case-overview-link"
              end
              onClick={() => setActiveNav(NavState.CASE_OVERVIEW)}
              title="view basic details about the current case"
              to={`/case-detail/${caseId}/`}
            >
              Case Overview
            </NavLink>
          </li>
          <li className="usa-sidenav__item">
            <NavLink
              className={'usa-nav-link ' + setCurrentNav(activeNav, NavState.COURT_DOCKET)}
              data-testid="court-docket-link"
              onClick={() => setActiveNav(NavState.COURT_DOCKET)}
              title="view court docket entries"
              to={`/case-detail/${caseId}/court-docket`}
            >
              Court Docket
            </NavLink>
          </li>
          {caseNotesEnabledFlag && (
            <li className="usa-sidenav__item">
              <NavLink
                className={'usa-nav-link ' + setCurrentNav(activeNav, NavState.CASE_NOTES)}
                data-testid="case-notes-link"
                onClick={() => setActiveNav(NavState.CASE_NOTES)}
                title="view case notes"
                to={`/case-detail/${caseId}/notes`}
              >
                Case Notes
              </NavLink>
            </li>
          )}
          <li className="usa-sidenav__item">
            <NavLink
              className={'usa-nav-link ' + setCurrentNav(activeNav, NavState.AUDIT_HISTORY)}
              data-testid="audit-history-link"
              onClick={() => setActiveNav(NavState.AUDIT_HISTORY)}
              title="view case audit history"
              to={`/case-detail/${caseId}/audit-history`}
            >
              Change History
            </NavLink>
          </li>
          {showAssociatedCasesList && (
            <li className="usa-sidenav__item">
              <NavLink
                className={'usa-nav-link ' + setCurrentNav(activeNav, NavState.ASSOCIATED_CASES)}
                data-testid="associated-cases-link"
                onClick={() => setActiveNav(NavState.ASSOCIATED_CASES)}
                title="view associated cases"
                to={`/case-detail/${caseId}/associated-cases`}
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

export function mapNavState(path: string) {
  const cleanPath = path.replace(/\/$/, '').split('/');
  switch (cleanPath[cleanPath.length - 1]) {
    case 'associated-cases':
      return NavState.ASSOCIATED_CASES;
    case 'audit-history':
      return NavState.AUDIT_HISTORY;
    case 'court-docket':
      return NavState.COURT_DOCKET;
    case 'notes':
      return NavState.CASE_NOTES;
    default:
      return NavState.CASE_OVERVIEW;
  }
}

export function setCurrentNav(activeNav: NavState, stateToCheck: NavState): string {
  return activeNav === stateToCheck ? 'usa-current current' : '';
}
