import { getCaseNumber } from '@/lib/utils/formatCaseNumber';
import { CaseDetailType } from '@/lib/type-declarations/chapter-15';

const informationUnavailable = 'Information is not available at this time.';

export interface CaseDetailContentProps {
  caseDetail: CaseDetailType;
  showReopenDate: boolean;
}

export default function CaseDetailContent(props: CaseDetailContentProps) {
  return (
    <div className="grid-row">
      <div className="grid-col-2"></div>
      <div className="grid-col-8">
        <div className="case-card-list">
          <div className="date-information padding-bottom-4 case-card">
            <h3>Dates</h3>
            <div className="date-list">
              <ul className="usa-list usa-list--unstyled">
                <li data-testid="case-detail-filed-date">
                  <span className="case-detail-item-name">Filed:</span>
                  <span className="case-detail-item-value">{props.caseDetail.dateFiled}</span>
                </li>
                {props.caseDetail.reopenedDate && props.showReopenDate && (
                  <li data-testid="case-detail-reopened-date">
                    <span className="case-detail-item-name">Reopened by court:</span>
                    <span className="case-detail-item-value">{props.caseDetail.reopenedDate}</span>
                  </li>
                )}
                {!props.showReopenDate && (
                  <li data-testid="case-detail-closed-date">
                    <span className="case-detail-item-name">Closed by court:</span>
                    <span className="case-detail-item-value">{props.caseDetail.closedDate}</span>
                  </li>
                )}
                {props.caseDetail.dismissedDate && (
                  <li data-testid="case-detail-dismissed-date">
                    <span className="case-detail-item-name">Dismissed by court:</span>
                    <span className="case-detail-item-value">{props.caseDetail.dismissedDate}</span>
                  </li>
                )}
              </ul>
            </div>
          </div>
          <div className="assigned-staff-information padding-bottom-4 case-card">
            <h3>Assigned Staff</h3>
            <div className="assigned-staff-list">
              {props.caseDetail.regionId && (
                <div
                  className="case-detail-region-id"
                  data-testid="case-detail-region-id"
                  aria-label="assigned region and office"
                >
                  Region {props.caseDetail.regionId.replace(/^0*/, '')} -{' '}
                  {props.caseDetail.officeName} Office
                </div>
              )}
              <ul className="usa-list usa-list--unstyled">
                {props.caseDetail.assignments?.length > 0 &&
                  (props.caseDetail.assignments as Array<string>)?.map(
                    (staff: string, idx: number) => {
                      return (
                        <li key={idx} className="individual-assignee">
                          <span className="assignee-name">{staff}</span>
                          <span className="vertical-divider">|</span>
                          <span className="assignee-role">Trial Attorney</span>
                        </li>
                      );
                    },
                  )}
                {props.caseDetail.assignments?.length == 0 && (
                  <span className="unassigned-placeholder">(unassigned)</span>
                )}
              </ul>
            </div>
          </div>
          <div className="judge-information padding-bottom-4 case-card">
            <h3>Judge</h3>
            {props.caseDetail.judgeName && (
              <div className="case-detail-judge-name" data-testid="case-detail-judge-name">
                {props.caseDetail.judgeName}
              </div>
            )}
            {!props.caseDetail.judgeName && (
              <div className="case-detail-judge-name" data-testid="case-detail-no-judge-name">
                {informationUnavailable}
              </div>
            )}
          </div>
          <div className="debtor-information padding-bottom-4 case-card">
            <h3>Debtor</h3>
            <div data-testid="case-detail-debtor-name" aria-label="debtor name">
              {props.caseDetail.debtor.name}
            </div>
            <div data-testid="case-detail-debtor-type" aria-label="debtor type">
              {props.caseDetail.debtorTypeLabel}
            </div>
            <div
              className="padding-bottom-1"
              data-testid="case-detail-petition"
              aria-label="petition"
            >
              {props.caseDetail.petitionLabel}
            </div>
            <div>
              {props.caseDetail.debtor.address1 && (
                <div data-testid="case-detail-debtor-address1" aria-label="debtor address line 1">
                  {props.caseDetail.debtor.address1}
                </div>
              )}
              {props.caseDetail.debtor.address2 && (
                <div data-testid="case-detail-debtor-address2" aria-label="debtor address line 2">
                  {props.caseDetail.debtor.address2}
                </div>
              )}
              {props.caseDetail.debtor.address3 && (
                <div data-testid="case-detail-debtor-address3" aria-label="debtor address line 3">
                  {props.caseDetail.debtor.address3}
                </div>
              )}
              {props.caseDetail.debtor.cityStateZipCountry && (
                <div
                  data-testid="case-detail-debtor-cityStateZipCountry"
                  aria-label="debtor city, state, zip, country"
                >
                  {props.caseDetail.debtor.cityStateZipCountry}
                </div>
              )}
            </div>
          </div>
          <div className="debtor-counsel-information padding-bottom-4 case-card">
            <h3>Debtor&apos;s Counsel</h3>
            {props.caseDetail.debtorAttorney && (
              <>
                <div
                  className="padding-bottom-1"
                  data-testid="case-detail-debtor-counsel-name"
                  aria-label="debtor counsel name"
                >
                  {props.caseDetail.debtorAttorney.name}
                </div>
                <div>
                  {props.caseDetail.debtorAttorney.address1 && (
                    <div
                      data-testid="case-detail-debtor-counsel-address1"
                      aria-label="debtor counsel address line 1"
                    >
                      {props.caseDetail.debtorAttorney.address1}
                    </div>
                  )}
                  {props.caseDetail.debtorAttorney.address2 && (
                    <div
                      data-testid="case-detail-debtor-counsel-address2"
                      aria-label="debtor counsel address line 2"
                    >
                      {props.caseDetail.debtorAttorney.address2}
                    </div>
                  )}
                  {props.caseDetail.debtorAttorney.address3 && (
                    <div
                      data-testid="case-detail-debtor-counsel-address3"
                      aria-label="debtor counsel address line 3"
                    >
                      {props.caseDetail.debtorAttorney.address3}
                    </div>
                  )}
                  {props.caseDetail.debtorAttorney.cityStateZipCountry && (
                    <div
                      data-testid="case-detail-debtor-counsel-cityStateZipCountry"
                      aria-label="debtor counsel city, state, zip, country"
                    >
                      {props.caseDetail.debtorAttorney.cityStateZipCountry}
                    </div>
                  )}
                  {props.caseDetail.debtorAttorney.phone && (
                    <div
                      data-testid="case-detail-debtor-counsel-phone"
                      aria-label="debtor counsel phone"
                    >
                      {props.caseDetail.debtorAttorney.phone}
                    </div>
                  )}
                  {props.caseDetail.debtorAttorney.email && (
                    <div
                      data-testid="case-detail-debtor-counsel-email"
                      aria-label="debtor counsel email"
                    >
                      <a
                        href={`mailto:${
                          props.caseDetail.debtorAttorney.email
                        }?subject=${getCaseNumber(props.caseDetail.caseId)} - ${
                          props.caseDetail.caseTitle
                        }`}
                      >
                        {props.caseDetail.debtorAttorney.email}
                      </a>
                    </div>
                  )}
                </div>
              </>
            )}
            {!props.caseDetail.debtorAttorney && (
              <div data-testid="case-detail-no-debtor-attorney" aria-label="debtor attorney">
                {informationUnavailable}
              </div>
            )}
          </div>
          <div className="additional-debtor-information padding-bottom-4 case-card">
            <h3>Additional Debtor Info</h3>
            {props.caseDetail.debtor.taxId && (
              <div
                data-testid="case-detail-debtor-taxId"
                aria-label="debtor employer identification number"
              >
                <span className="case-detail-item-name">EIN:</span>
                <span className="case-detail-item-value">{props.caseDetail.debtor.taxId}</span>
              </div>
            )}
            {props.caseDetail.debtor.ssn && (
              <div data-testid="case-detail-debtor-ssn" aria-label="debtor social security number">
                <span className="case-detail-item-name">SSN/ITIN:</span>
                <span className="case-detail-item-value">{props.caseDetail.debtor.ssn}</span>
              </div>
            )}
            {!props.caseDetail.debtor.taxId && !props.caseDetail.debtor.ssn && (
              <div
                data-testid="case-detail-debtor-no-taxids"
                aria-label="debtor tax identification"
              >
                {informationUnavailable}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="grid-col-2"></div>
    </div>
  );
}
