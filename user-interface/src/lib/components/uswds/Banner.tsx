import './Banner.scss';
import { SkipToMainContentLink } from '../cams/SkipToMainContentLink/SkipToMainContentLink';

export const Banner = () => {
  const launchDarklyEnvironment = import.meta.env['CAMS_LAUNCH_DARKLY_ENV'];
  const environmentClass =
    launchDarklyEnvironment === 'production' ? '' : `${launchDarklyEnvironment}`;
  const envHeaderClassName = 'usa-banner__header ' + environmentClass;

  return (
    <section
      aria-label="Official website of the United States government"
      className="usa-banner cams-banner"
    >
      <SkipToMainContentLink>Skip to main content</SkipToMainContentLink>
      <header className={envHeaderClassName} data-testid="banner-header">
        <div className="usa-banner__inner header-container">
          <div className="header-flag-container">
            <img
              alt=""
              aria-hidden="true"
              className="usa-banner__header-flag banner-image"
              src="/assets/styles/img/us_flag_small.png"
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
        </div>
      </header>
    </section>
  );
};
