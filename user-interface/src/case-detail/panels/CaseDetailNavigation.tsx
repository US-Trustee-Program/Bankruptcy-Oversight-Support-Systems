import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import useFeatureFlags, { VIEW_TRUSTEE_ON_CASE } from '@/lib/hooks/UseFeatureFlags';
import { setCurrentNav, createNavStateMapper } from '@/lib/utils/navigation';

export enum CaseNavState {
  CASE_OVERVIEW,
  TRUSTEE_AND_ASSIGNED_STAFF,
  COURT_DOCKET,
  AUDIT_HISTORY,
  ASSOCIATED_CASES,
  CASE_NOTES,
}

export const mapNavState = createNavStateMapper<CaseNavState>(
  {
    'court-docket': CaseNavState.COURT_DOCKET,
    'trustee-and-assigned-staff': CaseNavState.TRUSTEE_AND_ASSIGNED_STAFF,
    'audit-history': CaseNavState.AUDIT_HISTORY,
    'associated-cases': CaseNavState.ASSOCIATED_CASES,
    notes: CaseNavState.CASE_NOTES,
  },
  CaseNavState.CASE_OVERVIEW,
);

interface CaseDetailNavigationProps {
  caseId: string | undefined;
  showAssociatedCasesList: boolean;
  initiallySelectedNavLink: CaseNavState;
  className?: string;
}

export default function CaseDetailNavigation({
  caseId,
  showAssociatedCasesList,
  initiallySelectedNavLink,
  className,
}: CaseDetailNavigationProps) {
  const [activeNav, setActiveNav] = useState<CaseNavState>(initiallySelectedNavLink);

  const featureFlags = useFeatureFlags();

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
              className={
                'usa-sidenav__link ' + setCurrentNav(activeNav, CaseNavState.CASE_OVERVIEW)
              }
              onClick={() => setActiveNav(CaseNavState.CASE_OVERVIEW)}
              title="view basic details about the current case"
              end
            >
              Case Overview
            </NavLink>
          </li>
          {featureFlags[VIEW_TRUSTEE_ON_CASE] && (
            <li className="usa-sidenav__item">
              <NavLink
                to={`/case-detail/${caseId}/trustee-and-assigned-staff`}
                data-testid="case-trustee-and-assigned-staff-link"
                className={
                  'usa-sidenav__link ' +
                  setCurrentNav(activeNav, CaseNavState.TRUSTEE_AND_ASSIGNED_STAFF)
                }
                onClick={() => setActiveNav(CaseNavState.TRUSTEE_AND_ASSIGNED_STAFF)}
                title="view trustee and assigned staff details for the current case"
                end
              >
                Assigned Staff & Trustee
              </NavLink>
            </li>
          )}
          <li className="usa-sidenav__item">
            <NavLink
              to={`/case-detail/${caseId}/court-docket`}
              data-testid="court-docket-link"
              className={'usa-sidenav__link ' + setCurrentNav(activeNav, CaseNavState.COURT_DOCKET)}
              onClick={() => setActiveNav(CaseNavState.COURT_DOCKET)}
              title="view court docket entries"
            >
              Court Docket
            </NavLink>
          </li>
          <li className="usa-sidenav__item">
            <NavLink
              to={`/case-detail/${caseId}/notes`}
              data-testid="case-notes-link"
              className={'usa-sidenav__link ' + setCurrentNav(activeNav, CaseNavState.CASE_NOTES)}
              onClick={() => setActiveNav(CaseNavState.CASE_NOTES)}
              title="view case notes"
            >
              Case Notes
            </NavLink>
          </li>
          {showAssociatedCasesList && (
            <li className="usa-sidenav__item">
              <NavLink
                to={`/case-detail/${caseId}/associated-cases`}
                data-testid="associated-cases-link"
                className={
                  'usa-sidenav__link ' + setCurrentNav(activeNav, CaseNavState.ASSOCIATED_CASES)
                }
                onClick={() => setActiveNav(CaseNavState.ASSOCIATED_CASES)}
                title="view associated cases"
              >
                Associated Cases
              </NavLink>
            </li>
          )}
          <li className="usa-sidenav__item">
            <NavLink
              to={`/case-detail/${caseId}/audit-history`}
              data-testid="audit-history-link"
              className={
                'usa-sidenav__link ' + setCurrentNav(activeNav, CaseNavState.AUDIT_HISTORY)
              }
              onClick={() => setActiveNav(CaseNavState.AUDIT_HISTORY)}
              title="view case audit history"
            >
              Change History
            </NavLink>
          </li>
        </ul>
      </nav>
    </>
  );
}
