import './CaseDetail.scss';
import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import Api from '../models/api';
import MockApi from '../models/chapter15-mock.api.cases';
import { CaseDetailType, Chapter15CaseDetailsResponseData } from '../type-declarations/chapter-15';
import { getCaseNumber } from '../utils/formatCaseNumber';
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
                    <li>
                      <span className="case-detail-item-name">Filed:</span>
                      <span data-testid="case-detail-filed-date" className="case-detail-item-value">
                        {caseDetail.dateFiled}
                      </span>
                    </li>
                    {caseDetail.reopenedDate &&
                      showReopenDate(caseDetail.reopenedDate, caseDetail.closedDate) && (
                        <li>
                          <span className="case-detail-item-name">Reopened by court:</span>
                          <span
                            data-testid="case-detail-reopened-date"
                            className="case-detail-item-value"
                          >
                            {caseDetail.reopenedDate}
                          </span>
                        </li>
                      )}
                    {!showReopenDate(caseDetail.reopenedDate, caseDetail.closedDate) && (
                      <li>
                        <span className="case-detail-item-name">Closed by court:</span>
                        <span
                          data-testid="case-detail-closed-date"
                          className="case-detail-item-value"
                        >
                          {caseDetail.closedDate}
                        </span>
                      </li>
                    )}
                    {caseDetail.dismissedDate && (
                      <li>
                        <span className="case-detail-item-name">Dismissed by court:</span>
                        <span
                          data-testid="case-detail-dismissed-date"
                          className="case-detail-item-value"
                        >
                          {caseDetail.dismissedDate}
                        </span>
                      </li>
                    )}
                  </ul>
                </div>
              </div>
              <div className="assigned-staff-information padding-bottom-4 case-card">
                <h3>Assigned Staff</h3>
                <div className="assigned-staff-list">
                  <ul className="usa-list usa-list--unstyled">
                    {caseDetail.assignments.length > 0 &&
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
                    {caseDetail.assignments.length == 0 && (
                      <span className="unassigned-placeholder">(unassigned)</span>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }
};
