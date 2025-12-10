import { Banner } from '@/lib/components/uswds/Banner';
import { PropsWithChildren } from 'react';
import '@/lib/components/Header.scss';
import './BlankPage.scss';
import { MainContent } from '@/lib/components/cams/MainContent/MainContent';

type BlankPageProps = PropsWithChildren;

export function BlankPage(props: BlankPageProps) {
  return (
    <MainContent className="blank-page">
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
            <div className="site-title">
              <span className="text-no-wrap">U.S. Trustee Program</span>
              <span className="sub-title text-no-wrap">Case Management System (CAMS)</span>
            </div>
          </div>
        </div>
      </header>
      <div className="main-content">
        <div className="grid-row grid-gap-lg">
          <div className="grid-col-1"></div>
          <div className="grid-col-10 centered">{props.children}</div>
          <div className="grid-col-1"></div>
        </div>
      </div>
    </MainContent>
  );
}
