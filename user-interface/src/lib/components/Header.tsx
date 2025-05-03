import { ADMIN_PATH } from '@/admin/admin-config';
import { LOGOUT_PATH } from '@/login/login-library';

import './Header.scss';

import { CamsRole } from '@common/cams/roles';
import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

import useFeatureFlags, {
  PRIVILEGED_IDENTITY_MANAGEMENT,
  SYSTEM_MAINTENANCE_BANNER,
  TRANSFER_ORDERS_ENABLED,
} from '../hooks/UseFeatureFlags';
import LocalStorage from '../utils/local-storage';
import { DropdownMenu, MenuItem } from './cams/DropdownMenu/DropdownMenu';
import Alert, { UswdsAlertStyle } from './uswds/Alert';
import { Banner } from './uswds/Banner';
import Icon from './uswds/Icon';

export enum NavState {
  DEFAULT,
  CASE_DETAIL,
  DATA_VERIFICATION,
  MY_CASES,
  SEARCH,
  STAFF_ASSIGNMENT,
  USER,
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

const userMenuItems: MenuItem[] = [
  {
    address: 'https://doj365.sharepoint.us/sites/USTP-OIT/SitePages/CAMS.aspx',
    label: 'Help',
    target: 'cams_help',
  },
  {
    address: LOGOUT_PATH,
    label: 'Logout',
  },
];

export function setCurrentNav(activeNav: NavState, stateToCheck: NavState): string {
  return activeNav === stateToCheck ? 'usa-current current' : '';
}

export const Header = () => {
  const session = LocalStorage.getSession();
  const location = useLocation();
  const flags = useFeatureFlags();
  const transferOrdersFlag = flags[TRANSFER_ORDERS_ENABLED];

  const [activeNav, setActiveNav] = useState<NavState>(mapNavState(location.pathname));

  if (flags[PRIVILEGED_IDENTITY_MANAGEMENT] && session?.user.roles?.includes(CamsRole.SuperUser)) {
    if (!userMenuItems.find((menuItem) => menuItem.label === 'Admin')) {
      userMenuItems.unshift({
        address: ADMIN_PATH,
        label: 'Admin',
      });
    }
  }

  useEffect(() => {
    setActiveNav(mapNavState(location.pathname));
  }, [location]);

  return (
    <>
      <Banner></Banner>
      <div className="usa-overlay"></div>
      <header className="cams-header usa-header usa-header--basic" role="banner">
        <div className="usa-nav-container">
          <div className="cams-logo-and-title">
            <div className="usa-navbar">
              <div className="cams-logo usa-logo">
                <img alt="" className="doj-logo usa-banner__header" src="/doj-logo.png"></img>
              </div>
            </div>
            <div className="site-title wide-screen">
              <span className="text-no-wrap">U.S. Trustee Program</span>
              <span className="sub-title text-no-wrap">CAse Management System (CAMS)</span>
            </div>
            <div className="site-title small-screen">
              <span className="text-no-wrap" title="U.S. Trustee Program, Case Management System">
                USTP CAMS
              </span>
              <span className="sub-title text-no-wrap"></span>
            </div>
          </div>
          <div className="cams-main-navigation">
            <nav aria-label="Main menu" className="usa-nav cams-nav-bar" role="navigation">
              <ul className="usa-nav__primary">
                <li className="usa-nav__primary-item">
                  <NavLink
                    className={'usa-nav-link ' + setCurrentNav(activeNav, NavState.MY_CASES)}
                    data-testid="header-my-cases-link"
                    onClick={() => setActiveNav(NavState.MY_CASES)}
                    title="view a list of cases assigned to your account"
                    to="/my-cases"
                  >
                    My Cases
                  </NavLink>
                </li>

                {session && session.user.roles?.includes(CamsRole.CaseAssignmentManager) && (
                  <li className="usa-nav__primary-item">
                    <NavLink
                      className={
                        'usa-nav-link ' + setCurrentNav(activeNav, NavState.STAFF_ASSIGNMENT)
                      }
                      data-testid="header-staff-assignment-link"
                      onClick={() => {
                        return setActiveNav(NavState.STAFF_ASSIGNMENT);
                      }}
                      title="view or edit staff assignments for cases"
                      to="/staff-assignment"
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
                        className={
                          'usa-nav-link ' + setCurrentNav(activeNav, NavState.DATA_VERIFICATION)
                        }
                        data-testid="header-data-verification-link"
                        onClick={() => {
                          return setActiveNav(NavState.DATA_VERIFICATION);
                        }}
                        title="view status of, approve, or reject case events"
                        to="/data-verification"
                      >
                        Data Verification
                      </NavLink>
                    </li>
                  )}

                <li className="usa-nav__primary-item">
                  <NavLink
                    className={'usa-nav-link ' + setCurrentNav(activeNav, NavState.SEARCH)}
                    data-testid="header-search-link"
                    onClick={() => {
                      return setActiveNav(NavState.SEARCH);
                    }}
                    title="search for cases"
                    to="/search"
                  >
                    Case Search
                  </NavLink>
                </li>

                {session && (
                  <li className="usa-nav__primary-item">
                    <DropdownMenu
                      ariaLabel={`user menu for ${session.user.name}`}
                      className="header-menu"
                      id={'user-menu'}
                      menuItems={userMenuItems}
                    >
                      <Icon name="person"></Icon>
                      {session.user.name}
                    </DropdownMenu>
                  </li>
                )}
              </ul>
            </nav>
          </div>
        </div>
      </header>
      {flags[SYSTEM_MAINTENANCE_BANNER] && (
        <div className="system-maintenance-banner grid-row">
          <div className="grid-col-1"></div>
          <div className="grid-col-10">
            <Alert
              inline={true}
              show={true}
              slim={true}
              title="System maintenance"
              type={UswdsAlertStyle.Warning}
            >
              {flags[SYSTEM_MAINTENANCE_BANNER]}
            </Alert>
          </div>
          <div className="grid-col-1"></div>
        </div>
      )}
    </>
  );
};
