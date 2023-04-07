import React from 'react';
import './Header.css';

export const Header = () => {
  return (
    <>
      <div className="usa-overlay"></div>
      <header className="usa-header usa-header--basic">
        <div className="usa-banner" id="-banner">
          <em className="usa-logo__text">
            <img
              className="usa-banner__header"
              src={require('../assets/ust-banner-photo.webp')}
              alt="U.S. Trustee Program banner"
            />
          </em>
        </div>
      </header>
    </>
  );
};

export default Header;
