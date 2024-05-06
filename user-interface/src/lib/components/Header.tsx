import { NavLink, useLocation } from 'react-router-dom';
import './Header.scss';
import useFeatureFlags, {
  CASE_SEARCH_ENABLED,
  TRANSFER_ORDERS_ENABLED,
} from '../hooks/UseFeatureFlags';
import { Banner } from './uswds/Banner';
import { useEffect, useState } from 'react';

export enum NavState {
  DEFAULT,
  CASES,
  DATA_VERIFICATION,
  SEARCH,
}

function mapNavState(path: string) {
  const cleanPath = path.replace(/^\//, '').split('/');
  switch (cleanPath[0]) {
    case 'case-assignment':
      return NavState.CASES;
    case 'case-detail':
      return NavState.CASES;
    case 'data-verification':
      return NavState.DATA_VERIFICATION;
    case 'search':
      return NavState.SEARCH;
    default:
      return NavState.DEFAULT;
  }
}

export function setCurrentNav(activeNav: NavState, stateToCheck: NavState): string {
  return activeNav === stateToCheck ? 'usa-current current' : '';
}

export interface HeaderProps {}

export const Header = () => {
  const location = useLocation();
  const flags = useFeatureFlags();
  const transferOrdersFlag = flags[TRANSFER_ORDERS_ENABLED];
  const caseSearchFlag = flags[CASE_SEARCH_ENABLED];
  const launchDarklyEnvironment = import.meta.env['CAMS_LAUNCH_DARKLY_ENV'];
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
            <span className="sub-title text-no-wrap">
              <p className="app-name">CAse Management System (CAMS)</p>
              {launchDarklyEnvironment != 'production' && (
                <p className="app-name app-environment">: {launchDarklyEnvironment} environment</p>
              )}
            </span>
          </div>
          <nav aria-label="Primary navigation" className="usa-nav cams-nav-bar" role="navigation">
            <button type="button" className="usa-nav__close">
              <img src="/assets/img/usa-icons/close.svg" role="img" alt="Close" />
            </button>
            <ul className="usa-nav__primary usa-accordion">
              <li className="usa-nav__primary-item">
                <NavLink
                  to="/case-assignment"
                  data-testid="header-cases-link"
                  className={'usa-nav-link ' + setCurrentNav(activeNav, NavState.CASES)}
                  onClick={() => {
                    return setActiveNav(NavState.CASES);
                  }}
                >
                  Cases
                </NavLink>
              </li>
              {transferOrdersFlag && (
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
