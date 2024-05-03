import { Banner } from '@/lib/components/uswds/Banner';
import { PropsWithChildren } from 'react';

export type BlankPageProps = PropsWithChildren;

export function BlankPage(props: BlankPageProps) {
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
            <ul className="usa-nav__primary usa-accordion"></ul>
          </nav>
        </div>
      </header>
      {props.children}
    </>
  );
}
