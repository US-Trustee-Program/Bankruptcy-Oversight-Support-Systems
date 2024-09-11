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
    case 'case-detail':
      return NavState.DEFAULT;
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

  useEffect(() => {
    setActiveNav(mapNavState(location.pathname));
  }, [location]);

  return (
    <>
      <Banner></Banner>
      <div className="usa-overlay"></div>
      <header role="banner" className="cams-header usa-header usa-header--basic">
        <div className="usa-nav-container">
          <div className="usa-navbar">
            <div className="cams-logo usa-logo">
              <img
                src="/doj-logo.png"
                alt="U.S. Trustee Program banner"
                className="doj-logo usa-banner__header"
              ></img>
            </div>
            <button type="button" className="usa-menu-btn">
              Menu
            </button>
          </div>
          <div className="site-title">
            <span className="text-no-wrap">U.S. Trustee Program</span>
            <span className="sub-title text-no-wrap">CAse Management System (CAMS)</span>
          </div>
          <nav aria-label="Primary navigation" className="usa-nav cams-nav-bar" role="navigation">
            <button type="button" className="usa-nav__close">
              <img src="/assets/img/usa-icons/close.svg" role="img" alt="Close" />
            </button>
            <ul className="usa-nav__primary usa-accordion">
              <li className="usa-nav__primary-item">
                <NavLink
                  to="/my-cases"
                  data-testid="header-my-cases-link"
                  className={'usa-nav-link ' + setCurrentNav(activeNav, NavState.MY_CASES)}
                  onClick={() => {
                    return setActiveNav(NavState.MY_CASES);
                  }}
                  title="view a list of cases assigned to your account"
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
                    onClick={() => {
                      return setActiveNav(NavState.STAFF_ASSIGNMENT);
                    }}
                    title="view or edit staff assignments for cases"
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
                      onClick={() => {
                        return setActiveNav(NavState.DATA_VERIFICATION);
                      }}
                      title="view status of, approve, or reject case events"
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
                    onClick={() => {
                      return setActiveNav(NavState.SEARCH);
                    }}
                    title="search for cases"
                  >
                    Case Search
                  </NavLink>
                </li>
              )}
            </ul>
          </nav>
        </div>
      </header>
    </>
  );
};
