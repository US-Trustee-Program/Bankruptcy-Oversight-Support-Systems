import { useContext } from 'react';
import './Banner.scss';
import { SessionContext } from '@/login/Session';
import { LOGOUT_PATH } from '@/login/login-helpers';
import Icon from './Icon';

export const Banner = () => {
  const launchDarklyEnvironment = import.meta.env['CAMS_LAUNCH_DARKLY_ENV'];
  const envHeaderClassName =
    'usa-banner__header ' +
    (launchDarklyEnvironment === 'production' ? '' : `${launchDarklyEnvironment}`);

  const session = useContext(SessionContext);

  return (
    <section
      className="usa-banner cams-banner"
      aria-label="Official website of the United States government"
    >
      <div className="usa-accordion">
        <header className={envHeaderClassName} data-testid="banner-header">
          <div className="usa-banner__inner flex-box">
            <div className="header-flag-container">
              <img
                aria-hidden="true"
                className="usa-banner__header-flag banner-image"
                src="/assets/styles/img/us_flag_small.png"
                alt=""
              />
              <span className="banner-text usa-banner__header-text">
                An official website of the United States government
              </span>
            </div>
            <div className="environment-text-container usa-banner__header-text">
              {launchDarklyEnvironment != 'production' && (
                <span className="environment-text">{launchDarklyEnvironment} ENVIRONMENT</span>
              )}
            </div>

            <div className="login-info">
              {session.user && (
                <>
                  <span className="user-icon">
                    <Icon name="person"></Icon>
                  </span>
                  <span className="user-name">{session.user?.name ?? 'UNKNOWN'} </span>
                  <span className="logout-link">
                    <a href={LOGOUT_PATH}>logout</a>
                  </span>
                </>
              )}
            </div>
          </div>
        </header>
      </div>
    </section>
  );
};
