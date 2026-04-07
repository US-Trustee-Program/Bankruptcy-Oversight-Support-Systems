import { useTrustee } from '../useTrustee';
import { TrusteeName } from '../TrusteeName';
import FormattedContact from '@/lib/components/cams/FormattedContact';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';

interface CaseTrusteeCardProps {
  trusteeId?: string;
}

export default function CaseTrusteeCard({ trusteeId }: Readonly<CaseTrusteeCardProps>) {
  const { trustee, loading } = useTrustee(trusteeId);

  return (
    <div data-testid="case-trustee-card" className="case-trustee-information usa-card">
      <div className="usa-card__container">
        <div className="usa-card__body">
          <h4>Trustee</h4>
          {!trusteeId && <div data-testid="case-trustee-card-empty">No trustee appointed.</div>}
          {trusteeId && loading && (
            <div data-testid="case-trustee-card-loading">Loading trustee information...</div>
          )}
          {trusteeId && !loading && trustee && (
            <>
              <div data-testid="case-trustee-card-name">
                <TrusteeName trusteeName={trustee.name} trusteeId={trusteeId} />
              </div>
              <div data-testid="case-trustee-public-contact">
                <h5>Public</h5>
                <FormattedContact contact={trustee.public} testIdPrefix="case-trustee-public" />
              </div>
              <div data-testid="case-trustee-internal-contact">
                <h5>Internal</h5>
                <Alert
                  message="Internal use only."
                  slim={true}
                  role="status"
                  inline={true}
                  show={true}
                  type={UswdsAlertStyle.Warning}
                />
                {trustee.internal ? (
                  <FormattedContact
                    contact={trustee.internal}
                    testIdPrefix="case-trustee-internal"
                  />
                ) : (
                  <div data-testid="case-trustee-internal-contact-empty">
                    No internal contact information.
                  </div>
                )}
              </div>
            </>
          )}
          {trusteeId && !loading && !trustee && (
            <div data-testid="case-trustee-card-empty">No trustee information available.</div>
          )}
        </div>
      </div>
    </div>
  );
}
