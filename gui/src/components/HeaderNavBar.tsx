import { NavLink } from 'react-router-dom';
import './HeaderNavBar.scss';

export const HeaderNavBar = () => {
  return (
    <>
      <div className="usa-overlay"></div>
      <header role="banner" className="boss-header usa-header usa-header--basic">
        <div className="usa-banner">
          <img
            src="doj-logo.png"
            alt="U.S. Trustee Program banner"
            className="doj-logo usa-banner__header"
          ></img>
          <div className="site-title">
            U.S. Trustee Program
            <span className="sub-title">Case Management System (CAMS)</span>
          </div>
          <nav className="nav-bar" role="navigation" aria-label="main-navigation">
            <NavLink to="/cases">Cases</NavLink>
            <NavLink to="/">Login</NavLink>
          </nav>
        </div>
      </header>
    </>
  );
};
