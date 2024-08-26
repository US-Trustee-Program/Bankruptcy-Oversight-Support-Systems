import { LOGOUT_PATH } from '@/login/login-library';
import Icon from './Icon';
import './Banner.scss';
import { LocalStorage } from '@/lib/utils/local-storage';
import { SkipToMainContentLink } from '../cams/SkipToMainContentLink/SkipToMainContentLink';

export const Banner = () => {
  const launchDarklyEnvironment = import.meta.env['CAMS_LAUNCH_DARKLY_ENV'];
  const environmentClass =
    launchDarklyEnvironment === 'production' ? '' : `${launchDarklyEnvironment}`;
  const envHeaderClassName = 'usa-banner__header ' + environmentClass;

  const session = LocalStorage.getSession();

  return (
    <section
      className="usa-banner cams-banner"
      aria-label="Official website of the United States government"
    >
      <SkipToMainContentLink>Skip to main content</SkipToMainContentLink>
      <header className={envHeaderClassName} data-testid="banner-header">
        <div className="usa-banner__inner header-container">
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

          <nav className="cams-banner-nav">
            <div className="login-info">
              {session?.user && (
                <>
                  <span className="user-info">
                    <span className="user-icon">
                      <Icon name="person"></Icon>
                    </span>
                    <span className="user-name">{session.user.name} </span>
                  </span>
                  <span className="logout-link">
                    <a href={LOGOUT_PATH}>logout</a>
                  </span>
                </>
              )}
            </div>
          </nav>
        </div>
      </header>
    </section>
  );
};
