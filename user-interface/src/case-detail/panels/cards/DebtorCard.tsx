import './DebtorCard.scss';
import { Debtor, DebtorAttorney } from '@common/cams/parties';
import CommsLink from '@/lib/components/cams/CommsLink/CommsLink';
import { parsePhoneNumber } from '@common/phone-helper';

interface DebtorCardProps {
  title: string;
  debtor: Debtor;
  debtorTypeLabel?: string;
  attorney?: DebtorAttorney;
  caseId: string;
  caseTitle: string;
  testIdPrefix: string;
}

const taxIdUnavailable = 'Tax ID information is not available.';
const informationUnavailable = 'Information is not available.';

export default function DebtorCard(props: Readonly<DebtorCardProps>) {
  const { title, debtor, debtorTypeLabel, attorney, caseId, caseTitle, testIdPrefix } = props;
  const hasDebtorAddress =
    debtor.address1 || debtor.address2 || debtor.address3 || debtor.cityStateZipCountry;
  const hasAttorneyAddress =
    attorney &&
    (attorney.address1 || attorney.address2 || attorney.address3 || attorney.cityStateZipCountry);

  return (
    <div className="debtor-card-container">
      <h3>{title}</h3>
      <div className="debtor-info-grid">
        <div className="debtor-info-card usa-card">
          <div className="usa-card__container">
            <div className="usa-card__body">
              <h4>Debtor Information</h4>

              <div className="info-group">
                <div data-testid={`${testIdPrefix}-name`}>{debtor.name}</div>
              </div>

              {(debtor.ssn || debtor.taxId) && (
                <div className="info-group">
                  <dl>
                    {debtor.ssn && (
                      <div data-testid={`${testIdPrefix}-ssn`}>
                        <dt className="case-detail-item-name">SSN:</dt>
                        <dd className="case-detail-item-value">{debtor.ssn}</dd>
                      </div>
                    )}
                    {debtor.taxId && (
                      <div data-testid={`${testIdPrefix}-taxId`}>
                        <dt className="case-detail-item-name">EIN:</dt>
                        <dd className="case-detail-item-value">{debtor.taxId}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}
              {!debtor.ssn && !debtor.taxId && (
                <div className="info-group" data-testid={`${testIdPrefix}-no-taxids`}>
                  {taxIdUnavailable}
                </div>
              )}

              {debtorTypeLabel && (
                <div className="info-group" data-testid={`${testIdPrefix}-type`}>
                  {debtorTypeLabel}
                </div>
              )}

              {hasDebtorAddress && (
                <div className="info-group address">
                  {debtor.address1 && (
                    <div className="address1" data-testid={`${testIdPrefix}-address1`}>
                      {debtor.address1}
                    </div>
                  )}
                  {debtor.address2 && (
                    <div className="address2" data-testid={`${testIdPrefix}-address2`}>
                      {debtor.address2}
                    </div>
                  )}
                  {debtor.address3 && (
                    <div className="address3" data-testid={`${testIdPrefix}-address3`}>
                      {debtor.address3}
                    </div>
                  )}
                  {debtor.cityStateZipCountry && (
                    <div className="city-state-zip" data-testid={`${testIdPrefix}-city-state-zip`}>
                      {debtor.cityStateZipCountry}
                    </div>
                  )}
                </div>
              )}

              {debtor.phone && (
                <div className="info-group phone" data-testid={`${testIdPrefix}-phone-number`}>
                  <CommsLink
                    contact={{ phone: parsePhoneNumber(debtor.phone) }}
                    mode="phone-dialer"
                  />
                </div>
              )}

              {debtor.email && (
                <div className="info-group email" data-testid={`${testIdPrefix}-email`}>
                  <CommsLink contact={{ email: debtor.email }} mode="email" />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="debtor-counsel-card usa-card">
          <div className="usa-card__container">
            <div className="usa-card__body">
              <h4>Counsel</h4>
              {attorney && (
                <>
                  <div className="info-group">
                    <div data-testid={`${testIdPrefix}-counsel-name`} aria-label="counsel name">
                      {attorney.name}
                    </div>
                    {attorney.office && (
                      <div
                        data-testid={`${testIdPrefix}-counsel-office`}
                        aria-label="counsel office"
                      >
                        {attorney.office}
                      </div>
                    )}
                  </div>

                  {hasAttorneyAddress && (
                    <div className="info-group address">
                      {attorney.address1 && (
                        <div className="address1" data-testid={`${testIdPrefix}-counsel-address1`}>
                          {attorney.address1}
                        </div>
                      )}
                      {attorney.address2 && (
                        <div className="address2" data-testid={`${testIdPrefix}-counsel-address2`}>
                          {attorney.address2}
                        </div>
                      )}
                      {attorney.address3 && (
                        <div className="address3" data-testid={`${testIdPrefix}-counsel-address3`}>
                          {attorney.address3}
                        </div>
                      )}
                      {attorney.cityStateZipCountry && (
                        <div
                          className="city-state-zip"
                          data-testid={`${testIdPrefix}-counsel-city-state-zip`}
                        >
                          {attorney.cityStateZipCountry}
                        </div>
                      )}
                    </div>
                  )}

                  {attorney.phone && (
                    <div
                      className="info-group phone"
                      data-testid={`${testIdPrefix}-counsel-phone-number`}
                    >
                      <CommsLink
                        contact={{ phone: parsePhoneNumber(attorney.phone) }}
                        mode="phone-dialer"
                      />
                    </div>
                  )}

                  {attorney.email && (
                    <div className="info-group email" data-testid={`${testIdPrefix}-counsel-email`}>
                      <CommsLink
                        contact={{ email: attorney.email }}
                        mode="email"
                        emailSubject={`${caseId} - ${caseTitle}`}
                      />
                    </div>
                  )}
                </>
              )}
              {!attorney && (
                <div data-testid={`${testIdPrefix}-no-attorney`} aria-label="attorney">
                  {informationUnavailable}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
