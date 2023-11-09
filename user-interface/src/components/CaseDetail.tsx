import './CaseDetail.scss';
import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import Api from '../models/api';
import MockApi from '../models/chapter15-mock.api.cases';
import { CaseDetailType, Chapter15CaseDetailsResponseData } from '@/type-declarations/chapter-15';
import { getCaseNumber } from '@/utils/formatCaseNumber';
import Icon from './uswds/Icon';

interface CaseDetailProps {
  caseDetail?: CaseDetailType;
}

function showReopenDate(reOpenDate: string | undefined, closedDate: string | undefined) {
  if (reOpenDate) {
    if (closedDate && reOpenDate > closedDate) {
      return true;
    }
  }
  return false;
}
const informationUnavailable = 'Information is not available at this time.';

export const CaseDetail = (props: CaseDetailProps) => {
  const { caseId } = useParams();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const api = import.meta.env['CAMS_PA11Y'] === 'true' ? MockApi : Api;
  const [caseDetail, setCaseDetail] = useState<CaseDetailType>();

  const fetchCaseDetail = async () => {
    setIsLoading(true);
    api.get(`/cases/${caseId}`, {}).then((data) => {
      const response = data as Chapter15CaseDetailsResponseData;
      setCaseDetail(response.body?.caseDetails);
      setIsLoading(false);
    });
  };

  useEffect(() => {
    if (props.caseDetail) {
      setCaseDetail(props.caseDetail);
    } else if (!isLoading) {
      fetchCaseDetail();
    }
  }, [caseDetail !== undefined]);

  if (isLoading) {
    return (
      <div className="case-detail">
        <Link className="back-button" to="/case-assignment">
          <Icon name="arrow_back"></Icon>
          Back to Case List
        </Link>

        <h1 data-testid="case-detail-heading">Loading Case Details...</h1>
        <h2>
          <span className="case-number" title="Case Number">
            {getCaseNumber(caseId)}
          </span>
        </h2>
        <p data-testid="loading-indicator">Loading...</p>
      </div>
    );
  } else {
    return (
      <>
        {caseDetail && (
          <div className="case-detail">
            <Link className="back-button" to="/case-assignment">
              <Icon name="arrow_back"></Icon>
              Back to Case List
            </Link>

            <h1 data-testid="case-detail-heading">{caseDetail.caseTitle}</h1>
            <h2>
              <span className="case-number" title="Case Number">
                {getCaseNumber(caseDetail.caseId)}
              </span>
              <span className="case-chapter" title="Case Chapter" data-testid="case-chapter">
                Chapter {caseDetail.chapter}
              </span>
            </h2>

            <div className="case-card-list">
              <div className="date-information padding-bottom-4 case-card">
                <h3>Dates</h3>
                <div className="date-list">
                  <ul className="usa-list usa-list--unstyled">
                    <li data-testid="case-detail-filed-date">
                      <span className="case-detail-item-name">Filed:</span>
                      <span className="case-detail-item-value">{caseDetail.dateFiled}</span>
                    </li>
                    {caseDetail.reopenedDate &&
                      showReopenDate(caseDetail.reopenedDate, caseDetail.closedDate) && (
                        <li data-testid="case-detail-reopened-date">
                          <span className="case-detail-item-name">Reopened by court:</span>
                          <span className="case-detail-item-value">{caseDetail.reopenedDate}</span>
                        </li>
                      )}
                    {!showReopenDate(caseDetail.reopenedDate, caseDetail.closedDate) && (
                      <li data-testid="case-detail-closed-date">
                        <span className="case-detail-item-name">Closed by court:</span>
                        <span className="case-detail-item-value">{caseDetail.closedDate}</span>
                      </li>
                    )}
                    {caseDetail.dismissedDate && (
                      <li data-testid="case-detail-dismissed-date">
                        <span className="case-detail-item-name">Dismissed by court:</span>
                        <span className="case-detail-item-value">{caseDetail.dismissedDate}</span>
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
                      Region {caseDetail.regionId.replace(/^0*/, '')} - {caseDetail.officeName}{' '}
                      Office
                    </div>
                  )}
                  <ul className="usa-list usa-list--unstyled">
                    {caseDetail.assignments?.length > 0 &&
                      (caseDetail.assignments as Array<string>)?.map(
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
                <div
                  className="padding-bottom-1"
                  data-testid="case-detail-debtor-name"
                  aria-label="debtor name"
                >
                  {caseDetail.debtor.name}
                </div>
                <div>
                  {caseDetail.debtor.address1 && (
                    <div
                      data-testid="case-detail-debtor-address1"
                      aria-label="debtor address line 1"
                    >
                      {caseDetail.debtor.address1}
                    </div>
                  )}
                  {caseDetail.debtor.address2 && (
                    <div
                      data-testid="case-detail-debtor-address2"
                      aria-label="debtor address line 2"
                    >
                      {caseDetail.debtor.address2}
                    </div>
                  )}
                  {caseDetail.debtor.address3 && (
                    <div
                      data-testid="case-detail-debtor-address3"
                      aria-label="debtor address line 3"
                    >
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
                    <div>
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
                      {caseDetail.debtorAttorney.phone && (
                        <div
                          data-testid="case-detail-debtor-counsel-phone"
                          aria-label="debtor counsel phone"
                        >
                          {caseDetail.debtorAttorney.phone}
                        </div>
                      )}
                      {caseDetail.debtorAttorney.email && (
                        <div
                          data-testid="case-detail-debtor-counsel-email"
                          aria-label="debtor counsel email"
                        >
                          <a
                            href={`mailto:${
                              caseDetail.debtorAttorney.email
                            }?subject=${getCaseNumber(caseDetail.caseId)} - ${
                              caseDetail.caseTitle
                            }`}
                          >
                            {caseDetail.debtorAttorney.email}
                          </a>
                        </div>
                      )}
                    </div>
                  </>
                )}
                {!caseDetail.debtorAttorney && (
                  <div data-testid="case-detail-no-debtor-attorney" aria-label="debtor attorney">
                    {informationUnavailable}
                  </div>
                )}
              </div>
              <div className="additional-debtor-information padding-bottom-4 case-card">
                <h3>Additional Debtor Info</h3>
                {caseDetail.debtor.taxId && (
                  <div
                    data-testid="case-detail-debtor-taxId"
                    aria-label="debtor employer identification number"
                  >
                    <span className="case-detail-item-name">EIN:</span>
                    <span className="case-detail-item-value">{caseDetail.debtor.taxId}</span>
                  </div>
                )}
                {caseDetail.debtor.ssn && (
                  <div
                    data-testid="case-detail-debtor-ssn"
                    aria-label="debtor social security number"
                  >
                    <span className="case-detail-item-name">SSN/ITIN:</span>
                    <span className="case-detail-item-value">{caseDetail.debtor.ssn}</span>
                  </div>
                )}
                {!caseDetail.debtor.taxId && !caseDetail.debtor.ssn && (
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
        )}
      </>
    );
  }
};
