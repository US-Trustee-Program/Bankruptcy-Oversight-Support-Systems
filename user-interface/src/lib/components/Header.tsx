import { NavLink, useLocation } from 'react-router-dom';
import { LOGOUT_PATH } from '@/login/login-library';
import './Header.scss';
import useFeatureFlags, {
  TRANSFER_ORDERS_ENABLED,
  SYSTEM_MAINTENANCE_BANNER,
  TRUSTEE_MANAGEMENT,
} from '../hooks/UseFeatureFlags';
import { Banner } from './uswds/Banner';
import { useEffect, useState } from 'react';
import LocalStorage from '../utils/local-storage';
import { CamsRole } from '@common/cams/roles';
import Icon from './uswds/Icon';
import { DropdownMenu, MenuItem } from './cams/DropdownMenu/DropdownMenu';
import { ADMIN_PATH } from '@/admin/admin-config';
import Alert, { UswdsAlertStyle } from './uswds/Alert';
import { CamsSession } from '@common/cams/session';

export enum NavState {
  DEFAULT,
  CASE_DETAIL,
  DATA_VERIFICATION,
  MY_CASES,
  SEARCH,
  STAFF_ASSIGNMENT,
  USER,
  TRUSTEES,
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
    case 'trustees':
      return NavState.TRUSTEES;
    default:
      return NavState.DEFAULT;
  }
}

const userMenuItems: MenuItem[] = [
  {
    label: 'Help',
    address: 'https://doj365.sharepoint.us/sites/USTP-OIT/SitePages/CAMS.aspx',
    target: 'cams_help',
  },
  {
    label: 'Logout',
    address: LOGOUT_PATH,
  },
];

export function menuNeedsAdmin(session: CamsSession | null): boolean {
  return (
    !!session?.user.roles?.includes(CamsRole.SuperUser) &&
    !userMenuItems.find((menuItem) => menuItem.label === 'Admin')
  );
}

export function setCurrentNav(activeNav: NavState, stateToCheck: NavState): string {
  return activeNav === stateToCheck ? 'usa-current current' : '';
}

export const Header = () => {
  const session = LocalStorage.getSession();
  const location = useLocation();
  const flags = useFeatureFlags();
  const transferOrdersFlag = flags[TRANSFER_ORDERS_ENABLED];

  const [activeNav, setActiveNav] = useState<NavState>(mapNavState(location.pathname));

  if (menuNeedsAdmin(session)) {
    userMenuItems.unshift({
      label: 'Admin',
      address: ADMIN_PATH,
    });
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
          <div className="cams-logo-and-title">
            <div className="usa-navbar">
              <div className="cams-logo usa-logo">
                <img src="/doj-logo.png" alt="" className="doj-logo usa-banner__header"></img>
              </div>
            </div>
            <div className="site-title wide-screen">
              <span className="text-no-wrap">U.S. Trustee Program</span>
              <span className="sub-title text-no-wrap">Case Management System (CAMS)</span>
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
                    to="/my-cases"
                    data-testid="header-my-cases-link"
                    className={'usa-nav-link ' + setCurrentNav(activeNav, NavState.MY_CASES)}
                    onClick={() => setActiveNav(NavState.MY_CASES)}
                    title="View a list of cases assigned to your account."
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
                      title="View or edit staff assignments for cases."
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
                        title="View status of, approve, or reject case events."
                      >
                        Data Verification
                      </NavLink>
                    </li>
                  )}

                <li className="usa-nav__primary-item">
                  <NavLink
                    to="/search"
                    data-testid="header-search-link"
                    className={'usa-nav-link ' + setCurrentNav(activeNav, NavState.SEARCH)}
                    onClick={() => {
                      return setActiveNav(NavState.SEARCH);
                    }}
                    title="Search for cases."
                  >
                    Case Search
                  </NavLink>
                </li>

                {session &&
                  flags[TRUSTEE_MANAGEMENT] &&
                  session.user.roles?.includes(CamsRole.TrusteeAdmin) && (
                    <li className="usa-nav__primary-item">
                      <NavLink
                        to="/trustees"
                        data-testid="header-trustees-link"
                        className={'usa-nav-link ' + setCurrentNav(activeNav, NavState.TRUSTEES)}
                        onClick={() => setActiveNav(NavState.TRUSTEES)}
                        title="Manage trustee profiles."
                      >
                        Trustees
                      </NavLink>
                    </li>
                  )}

                {session && (
                  <li className="usa-nav__primary-item">
                    <DropdownMenu
                      id={'user-menu'}
                      menuItems={userMenuItems}
                      className="header-menu"
                      ariaLabel={`user menu for ${session.user.name}`}
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
      {!!flags[SYSTEM_MAINTENANCE_BANNER] && (
        <div className="system-maintenance-banner grid-row">
          <div className="grid-col-1"></div>
          <div className="grid-col-10">
            <Alert
              type={UswdsAlertStyle.Warning}
              title="System maintenance"
              slim={true}
              inline={true}
              show={true}
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
