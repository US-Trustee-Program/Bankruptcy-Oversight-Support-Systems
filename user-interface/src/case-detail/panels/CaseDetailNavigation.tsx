import './CaseDetailNavigation.scss';
import { useImperativeHandle, useState, forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { CaseDetailNavigationRef } from './CaseDetailNavigation.d';

export function mapNavState(path: string) {
  const cleanPath = path.replace(/\/$/, '').split('/');
  switch (cleanPath[cleanPath.length - 1]) {
    case 'court-docket':
      return NavState.COURT_DOCKET;
    default:
      return NavState.BASIC_INFO;
  }
}

export interface CaseDetailNavigationProps {
  caseId: string | undefined;
  initiallySelectedNavLink: NavState;
}

export enum NavState {
  BASIC_INFO,
  COURT_DOCKET,
}

export function setCurrentNav(activeNav: NavState, stateToCheck: NavState): string {
  return activeNav === stateToCheck ? 'usa-current' : '';
}

function CaseDetailNavigationComponent(
  { caseId, initiallySelectedNavLink }: CaseDetailNavigationProps,
  ref: React.Ref<CaseDetailNavigationRef>,
) {
  const [activeNav, setActiveNav] = useState<NavState>(initiallySelectedNavLink);
  const [navClassName, setNavClassName] = useState<string>('');

  useImperativeHandle(ref, () => ({
    fix: () => setNavClassName('fixed'),
    loosen: () => setNavClassName(''),
  }));

  return (
    <>
      <nav className={`case-details-navigation ${navClassName}`} aria-label="Side navigation">
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

const CaseDetailNavigation = forwardRef(CaseDetailNavigationComponent);

export default CaseDetailNavigation;
