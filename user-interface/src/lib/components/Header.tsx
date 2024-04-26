import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import './Header.scss';
import useFeatureFlags, { TRANSFER_ORDERS_ENABLED } from '../hooks/UseFeatureFlags';
import { Banner } from './uswds/Banner';
import { useEffect, useRef, useState } from 'react';
import CaseNumberInput from './CaseNumberInput';
import { InputRef } from '../type-declarations/input-fields';

export enum NavState {
  DEFAULT,
  CASES,
  DATA_VERIFICATION,
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
    default:
      return NavState.DEFAULT;
  }
}

export function setCurrentNav(activeNav: NavState, stateToCheck: NavState): string {
  return activeNav === stateToCheck ? 'usa-current current' : '';
}

export interface HeaderProps {}

export const Header = () => {
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(window.location.search);
  const flags = useFeatureFlags();
  const transferOrdersFlag = flags[TRANSFER_ORDERS_ENABLED];
  const location = useLocation();

  const [activeNav, setActiveNav] = useState<NavState>(mapNavState(location.pathname));
  const [caseNumber, setCaseNumber] = useState<string>(queryParams.get('caseNumber') ?? '');

  const caseNumberInputRef = useRef<InputRef>(null);

  useEffect(() => {
    setActiveNav(mapNavState(location.pathname));
  }, [location]);

  function handleCaseNumberInputChange(caseNumber: string): void {
    setCaseNumber(caseNumber);
    navigate(`/search?caseNumber=${caseNumber}`);
  }

  function handleCaseNumberInputButtonClick(): void {
    const caseNumberString = caseNumberInputRef.current?.getValue() ?? '';
    setCaseNumber(caseNumberString);
    navigate(`/search?caseNumber=${caseNumberString}`);
  }

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
            </ul>
            <section aria-label="Search by case number">
              <form className="usa-search usa-search--small" role="search">
                <label className="usa-sr-only" htmlFor="search-field">
                  Search
                </label>
                <CaseNumberInput
                  className="usa-input"
                  id="cams-global-search-field"
                  data-testid="cams-global-search-field"
                  type="search"
                  name="search"
                  onChange={handleCaseNumberInputChange}
                  forwardedRef={caseNumberInputRef}
                  value={caseNumber}
                  aria-label="search by case number"
                />
                <button
                  className="usa-button"
                  type="submit"
                  onClick={handleCaseNumberInputButtonClick}
                >
                  <img src="/search--white.svg" className="usa-search__submit-icon" alt="Search" />
                </button>
              </form>
            </section>
          </nav>
        </div>
      </header>
    </>
  );
};
