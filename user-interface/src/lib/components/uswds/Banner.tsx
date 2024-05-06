import './Banner.scss';

export const Banner = () => {
  const launchDarklyEnvironment = import.meta.env['CAMS_LAUNCH_DARKLY_ENV'];
  const envHeaderClassName =
    'usa-banner__header ' +
    (launchDarklyEnvironment === 'production' ? '' : `${launchDarklyEnvironment}`);

  return (
    <section
      className="usa-banner cams-banner"
      aria-label="Official website of the United States government"
    >
      <div className="usa-accordion">
        <header className={envHeaderClassName} data-testid="banner-header">
          <div className="usa-banner__inner grid-row grid-gap-sm">
            <div className="grid-col-1 header-flag-container">
              <img
                aria-hidden="true"
                className="usa-banner__header-flag"
                src="/assets/styles/img/us_flag_small.png"
                alt=""
              />
            </div>
            <div className="grid-col-auto tablet:grid-col-auto" aria-hidden="true">
              <span className="usa-banner__header-text">
                An official website of the United States government
              </span>
            </div>
            {launchDarklyEnvironment != 'production' && (
              <div className="grid-col-5 usa-banner__header-text">
                <span className="environment-text">{launchDarklyEnvironment} ENVIRONMENT</span>
              </div>
            )}
          </div>
        </header>
      </div>
    </section>
  );
};
