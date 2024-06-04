import './PrivacyActFooter.scss';

export const PrivacyActFooter = () => {
  return (
    <section className="usa-banner cams-banner">
      <div className="usa-accordion">
        <footer data-testid="privacy-footer">
          <div className="usa-banner__inner grid-row grid-gap-sm">
            <div className="grid-col-auto tablet:grid-col-auto">
              <div className="measure-6">
                <span className="usa-banner__header-text">
                  For Internal Use Only. The information is Limited Official Use and is subject to
                  the Privacy Act of 1974. The contents should not be disclosed, discussed, or
                  shared with individuals unless they have a direct need-to-know in the performance
                  of their official duties.
                </span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </section>
  );
};
