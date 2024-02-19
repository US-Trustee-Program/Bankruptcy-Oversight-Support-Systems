import { getCaseNumber } from '@/lib/utils/formatCaseNumber';
import { CaseDetailType } from '@/lib/type-declarations/chapter-15';
import Icon from '@/lib/components/uswds/Icon';
import { formatDate, sortDatesReverse } from '@/lib/utils/datetime';
import { CaseNumber } from '@/lib/components/CaseNumber';
import { Transfer } from '@common/cams/events';

const informationUnavailable = 'Information is not available.';
const taxIdUnavailable = 'Tax ID information is not available.';

export interface CaseDetailBasicInfoProps {
  caseDetail: CaseDetailType;
  showReopenDate: boolean;
}

export default function CaseDetailBasicInfo(props: CaseDetailBasicInfoProps) {
  const { caseDetail, showReopenDate } = props;

  function sortTransfers(a: Transfer, b: Transfer) {
    return sortDatesReverse(a.orderDate, b.orderDate);
  }

  return (
    <div className="grid-row grid-gap-lg">
      <span className="case-card-list grid-col-6">
        <div className="date-information padding-bottom-4 case-card">
          <h3>Dates</h3>
          <div className="date-list">
            <ul className="usa-list usa-list--unstyled">
              <li data-testid="case-detail-filed-date">
                <span className="case-detail-item-name">Filed:</span>
                <span className="case-detail-item-value">{formatDate(caseDetail.dateFiled)}</span>
              </li>
              {caseDetail.reopenedDate && showReopenDate && (
                <li data-testid="case-detail-reopened-date">
                  <span className="case-detail-item-name">Reopened by court:</span>
                  <span className="case-detail-item-value">
                    {formatDate(caseDetail.reopenedDate)}
                  </span>
                </li>
              )}
              {!showReopenDate && caseDetail.closedDate && (
                <li data-testid="case-detail-closed-date">
                  <span className="case-detail-item-name">Closed by court:</span>
                  <span className="case-detail-item-value">
                    {formatDate(caseDetail.closedDate)}
                  </span>
                </li>
              )}
              {caseDetail.dismissedDate && (
                <li data-testid="case-detail-dismissed-date">
                  <span className="case-detail-item-name">Dismissed by court:</span>
                  <span className="case-detail-item-value">
                    {formatDate(caseDetail.dismissedDate)}
                  </span>
                </li>
              )}
            </ul>
          </div>
        </div>
        <div className="assigned-staff-information padding-bottom-4 case-card">
          <h3>Assigned Staff</h3>
          <div className="assigned-staff-list">
            {caseDetail.regionId && (
              <div
                className="case-detail-region-id"
                data-testid="case-detail-region-id"
                aria-label="assigned region and office"
              >
                Region {caseDetail.regionId.replace(/^0*/, '')} - {caseDetail.officeName} Office
              </div>
            )}
            <ul className="usa-list usa-list--unstyled">
              {caseDetail.assignments?.length > 0 &&
                (caseDetail.assignments as Array<string>)?.map((staff: string, idx: number) => {
                  return (
                    <li key={idx} className="individual-assignee">
                      <span className="assignee-name">{staff}</span>
                      <span className="vertical-divider">|</span>
                      <span className="assignee-role">Trial Attorney</span>
                    </li>
                  );
                })}
              {caseDetail.assignments?.length == 0 && (
                <span className="unassigned-placeholder">(unassigned)</span>
              )}
            </ul>
          </div>
        </div>
        <div className="judge-information padding-bottom-4 case-card">
          <h3>Judge</h3>
          {caseDetail.judgeName && (
            <div className="case-detail-judge-name" data-testid="case-detail-judge-name">
              {caseDetail.judgeName}
            </div>
          )}
          {!caseDetail.judgeName && (
            <div className="case-detail-judge-name" data-testid="case-detail-no-judge-name">
              {informationUnavailable}
            </div>
          )}
        </div>
        <div className="debtor-information padding-bottom-4 case-card">
          <h3>Debtor</h3>
          <ul className="usa-list usa-list--unstyled">
            <li data-testid="case-detail-debtor-name" aria-label="debtor name">
              {caseDetail.debtor.name}
            </li>
            {caseDetail.debtor.taxId && (
              <li
                data-testid="case-detail-debtor-taxId"
                aria-label="debtor employer identification number"
              >
                <span className="case-detail-item-name">EIN:</span>
                <span className="case-detail-item-value">{caseDetail.debtor.taxId}</span>
              </li>
            )}
            {caseDetail.debtor.ssn && (
              <li data-testid="case-detail-debtor-ssn" aria-label="debtor social security number">
                <span className="case-detail-item-name">SSN/ITIN:</span>
                <span className="case-detail-item-value">{caseDetail.debtor.ssn}</span>
              </li>
            )}
            {!caseDetail.debtor.taxId && !caseDetail.debtor.ssn && (
              <li data-testid="case-detail-debtor-no-taxids" aria-label="debtor tax identification">
                {taxIdUnavailable}
              </li>
            )}
            <li data-testid="case-detail-debtor-type" aria-label="debtor type">
              {caseDetail.debtorTypeLabel}
            </li>
          </ul>
          {caseDetail.debtor.address1 && (
            <div data-testid="case-detail-debtor-address1" aria-label="debtor address line 1">
              {caseDetail.debtor.address1}
            </div>
          )}
          {caseDetail.debtor.address2 && (
            <div data-testid="case-detail-debtor-address2" aria-label="debtor address line 2">
              {caseDetail.debtor.address2}
            </div>
          )}
          {caseDetail.debtor.address3 && (
            <div data-testid="case-detail-debtor-address3" aria-label="debtor address line 3">
              {caseDetail.debtor.address3}
            </div>
          )}
          {caseDetail.debtor.cityStateZipCountry && (
            <div
              data-testid="case-detail-debtor-cityStateZipCountry"
              aria-label="debtor city, state, zip, country"
            >
              {caseDetail.debtor.cityStateZipCountry}
            </div>
          )}
        </div>
        <div className="debtor-counsel-information padding-bottom-4 case-card">
          <h3>Debtor&apos;s Counsel</h3>
          {caseDetail.debtorAttorney && (
            <>
              <div
                className="padding-bottom-1"
                data-testid="case-detail-debtor-counsel-name"
                aria-label="debtor counsel name"
              >
                {caseDetail.debtorAttorney.name}
              </div>
              {caseDetail.debtorAttorney.office && (
                <div
                  className="padding-bottom-1"
                  data-testid="case-detail-debtor-counsel-office"
                  aria-label="debtor counsel office"
                >
                  {caseDetail.debtorAttorney.office}
                </div>
              )}
              <div className="padding-bottom-1">
                {caseDetail.debtorAttorney.address1 && (
                  <div
                    data-testid="case-detail-debtor-counsel-address1"
                    aria-label="debtor counsel address line 1"
                  >
                    {caseDetail.debtorAttorney.address1}
                  </div>
                )}
                {caseDetail.debtorAttorney.address2 && (
                  <div
                    data-testid="case-detail-debtor-counsel-address2"
                    aria-label="debtor counsel address line 2"
                  >
                    {caseDetail.debtorAttorney.address2}
                  </div>
                )}
                {caseDetail.debtorAttorney.address3 && (
                  <div
                    data-testid="case-detail-debtor-counsel-address3"
                    aria-label="debtor counsel address line 3"
                  >
                    {caseDetail.debtorAttorney.address3}
                  </div>
                )}
                {caseDetail.debtorAttorney.cityStateZipCountry && (
                  <div
                    data-testid="case-detail-debtor-counsel-cityStateZipCountry"
                    aria-label="debtor counsel city, state, zip, country"
                  >
                    {caseDetail.debtorAttorney.cityStateZipCountry}
                  </div>
                )}
              </div>
              {caseDetail.debtorAttorney.phone && (
                <div
                  className="padding-bottom-1"
                  data-testid="case-detail-debtor-counsel-phone"
                  aria-label="debtor counsel phone"
                >
                  {caseDetail.debtorAttorney.phone}
                </div>
              )}
              {caseDetail.debtorAttorney.email && (
                <div
                  className="padding-bottom-1"
                  data-testid="case-detail-debtor-counsel-email"
                  aria-label="debtor counsel email"
                >
                  <a
                    href={`mailto:${caseDetail.debtorAttorney.email}?subject=${getCaseNumber(
                      caseDetail.caseId,
                    )} - ${caseDetail.caseTitle}`}
                  >
                    {caseDetail.debtorAttorney.email}
                    <Icon className="link-icon" name="mail_outline"></Icon>
                  </a>
                </div>
              )}
            </>
          )}
          {!caseDetail.debtorAttorney && (
            <div data-testid="case-detail-no-debtor-attorney" aria-label="debtor attorney">
              {informationUnavailable}
            </div>
          )}
        </div>
      </span>
      <span className="case-card-list grid-col-6">
        {!!caseDetail.transfers?.length && caseDetail.transfers.length > 0 && (
          <>
            <div>
              <h3>Transferred Case</h3>
            </div>
            <ul className="usa-list usa-list--unstyled">
              <div className="transfers case-card">
                {caseDetail.transfers
                  ?.sort(sortTransfers)
                  .map((transfer: Transfer, idx: number) => {
                    return (
                      <li key={idx} className="transfer">
                        <h4>
                          Transferred {transfer.documentType === 'TRANSFER_IN' ? 'from' : 'to'}:
                        </h4>
                        <div>
                          <span className="case-detail-item-name">Case Number:</span>
                          <CaseNumber
                            caseNumber={transfer.otherCaseId}
                            className="usa-link case-detail-item-value"
                            data-testid={`case-detail-transfer-link-${idx}`}
                          />
                        </div>
                        <div className="transfer-court">
                          <span className="case-detail-item-name">
                            {transfer.documentType === 'TRANSFER_IN' ? 'Previous' : 'New'} Court:
                          </span>
                          <span
                            className="case-detail-item-value"
                            data-testid={`case-detail-transfer-court-${idx}`}
                          >
                            {transfer.courtName} - {transfer.divisionName}
                          </span>
                        </div>
                        <div>
                          <span className="case-detail-item-name">Order Date:</span>
                          <span
                            className="case-detail-item-value"
                            data-testid={`case-detail-transfer-order-${idx}`}
                          >
                            {formatDate(transfer.orderDate)}
                          </span>
                        </div>
                      </li>
                    );
                  })}
              </div>
            </ul>
          </>
        )}
      </span>
    </div>
  );
}
