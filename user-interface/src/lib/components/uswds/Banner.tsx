import './Banner.scss';

export const Banner = () => {
  const launchDarklyEnvironment = import.meta.env['CAMS_LAUNCH_DARKLY_ENV'];
  const envHeaderClassName =
    'usa-banner__header ' +
    (launchDarklyEnvironment === 'production' ? '' : `${launchDarklyEnvironment}`);
  console.log(envHeaderClassName);

  return (
    <section
      className="usa-banner cams-banner"
      aria-label="Official website of the United States government"
    >
      <div className="usa-accordion">
        <header className={envHeaderClassName}>
          <div className="usa-banner__inner">
            <div className="grid-col-auto">
              <img
                aria-hidden="true"
                className="usa-banner__header-flag"
                src="/assets/styles/img/us_flag_small.png"
                alt=""
              />
            </div>
            <div className="grid-col-fill tablet:grid-col-auto" aria-hidden="true">
              <p className="usa-banner__header-text">
                An official website of the United States government
              </p>
            </div>
          </div>
        </header>
      </div>
    </section>
  );
};
