import { NavLink, useLocation } from 'react-router-dom';
import './Header.scss';
import useFeatureFlags, {
  CASE_SEARCH_ENABLED,
  TRANSFER_ORDERS_ENABLED,
} from '../hooks/UseFeatureFlags';
import { Banner } from './uswds/Banner';
import { useEffect, useState } from 'react';
import LocalStorage from '../utils/local-storage';
import { CamsRole } from '@common/cams/roles';

export enum NavState {
  DEFAULT,
  CASE_DETAIL,
  DATA_VERIFICATION,
  MY_CASES,
  SEARCH,
  STAFF_ASSIGNMENT,
}

function mapNavState(path: string) {
  const cleanPath = path.replace(/^\//, '').split('/');
  switch (cleanPath[0]) {
    case 'data-verification':
      return NavState.DATA_VERIFICATION;
    case 'my-cases':
      return NavState.MY_CASES;
    case 'search':
      return NavState.SEARCH;
    case 'staff-assignment':
      return NavState.STAFF_ASSIGNMENT;
    default:
      return NavState.DEFAULT;
  }
}

export function setCurrentNav(activeNav: NavState, stateToCheck: NavState): string {
  return activeNav === stateToCheck ? 'usa-current current' : '';
}

export const Header = () => {
  const session = LocalStorage.getSession();
  const location = useLocation();
  const flags = useFeatureFlags();
  const transferOrdersFlag = flags[TRANSFER_ORDERS_ENABLED];
  const caseSearchFlag = flags[CASE_SEARCH_ENABLED];

  const [activeNav, setActiveNav] = useState<NavState>(mapNavState(location.pathname));

  function handleLinkKeyDown(ev: React.KeyboardEvent) {
    if (ev.key === ' ') {
      ev.preventDefault();
      (ev.target as HTMLAnchorElement).click();
    }
  }

  useEffect(() => {
    setActiveNav(mapNavState(location.pathname));
  }, [location]);

  return (
    <>
      <Banner></Banner>
      <div className="usa-overlay"></div>
      <header role="banner" className="cams-header usa-header usa-header--basic">
        <div className="usa-nav-container">
          <div>
            <div className="usa-navbar">
              <div className="cams-logo usa-logo">
                <img src="/doj-logo.png" alt="" className="doj-logo usa-banner__header"></img>
              </div>
            </div>
            <div className="site-title">
              <span className="text-no-wrap">U.S. Trustee Program</span>
              <span className="sub-title text-no-wrap">CAse Management System (CAMS)</span>
            </div>
          </div>
          <nav aria-label="Primary navigation" className="usa-nav cams-nav-bar" role="navigation">
            <div role="menubar">
              <ul className="usa-nav__primary" role="menu">
                <li className="usa-nav__primary-item" role="menuitem">
                  <NavLink
                    to="/my-cases"
                    data-testid="header-my-cases-link"
                    className={'usa-nav-link ' + setCurrentNav(activeNav, NavState.MY_CASES)}
                    onClick={() => setActiveNav(NavState.MY_CASES)}
                    onKeyDown={handleLinkKeyDown}
                    title="view a list of cases assigned to your account"
                    aria-selected={activeNav === NavState.MY_CASES}
                    aria-current={activeNav === NavState.MY_CASES ? 'page' : undefined}
                  >
                    My Cases
                  </NavLink>
                </li>

                {session && session.user.roles?.includes(CamsRole.CaseAssignmentManager) && (
                  <li className="usa-nav__primary-item">
                    <NavLink
                      to="/staff-assignment"
                      data-testid="header-staff-assignment-link"
                      className={
                        'usa-nav-link ' + setCurrentNav(activeNav, NavState.STAFF_ASSIGNMENT)
                      }
                      onClick={() => setActiveNav(NavState.STAFF_ASSIGNMENT)}
                      onKeyDown={handleLinkKeyDown}
                      title="view or edit staff assignments for cases"
                      aria-selected={activeNav === NavState.STAFF_ASSIGNMENT}
                      aria-current={activeNav === NavState.STAFF_ASSIGNMENT ? 'page' : undefined}
                    >
                      Staff Assignment
                    </NavLink>
                  </li>
                )}

                {session &&
                  session.user.roles?.includes(CamsRole.DataVerifier) &&
                  transferOrdersFlag && (
                    <li className="usa-nav__primary-item">
                      <NavLink
                        to="/data-verification"
                        data-testid="header-data-verification-link"
                        className={
                          'usa-nav-link ' + setCurrentNav(activeNav, NavState.DATA_VERIFICATION)
                        }
                        onClick={() => setActiveNav(NavState.DATA_VERIFICATION)}
                        onKeyDown={handleLinkKeyDown}
                        title="view status of, approve, or reject case events"
                        aria-selected={activeNav === NavState.DATA_VERIFICATION}
                        aria-current={activeNav === NavState.DATA_VERIFICATION ? 'page' : undefined}
                      >
                        Data Verification
                      </NavLink>
                    </li>
                  )}

                {caseSearchFlag && (
                  <li className="usa-nav__primary-item">
                    <NavLink
                      to="/search"
                      data-testid="header-search-link"
                      className={'usa-nav-link ' + setCurrentNav(activeNav, NavState.SEARCH)}
                      onClick={() => setActiveNav(NavState.SEARCH)}
                      onKeyDown={handleLinkKeyDown}
                      title="search for cases"
                      aria-selected={activeNav === NavState.SEARCH}
                      aria-current={activeNav === NavState.SEARCH ? 'page' : undefined}
                    >
                      Case Search
                    </NavLink>
                  </li>
                )}
              </ul>
            </div>
          </nav>
        </div>
      </header>
    </>
  );
};
