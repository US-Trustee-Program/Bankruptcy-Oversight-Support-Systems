import './CaseDetail.scss';
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Api from '../models/api';
import MockApi from '../models/chapter15-mock.api.cases';
import {
  CaseDetailType,
  Chapter15CaseDetailsResponseData,
  StaffType,
} from '../type-declarations/chapter-15';

export const CaseDetail = () => {
  const { caseId } = useParams();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const api = import.meta.env['CAMS_PA11Y'] === 'true' ? MockApi : Api;
  const [caseDetail, setCaseDetail] = useState<CaseDetailType>({} as CaseDetailType);

  const fetchCaseDetail = async () => {
    setIsLoading(true);
    api.get(`/cases/${caseId}`, {}).then((data) => {
      const response = data as Chapter15CaseDetailsResponseData;
      console.log(response);
      setCaseDetail(response.body?.caseDetails);
      setIsLoading(false);
    });
  };

  useEffect(() => {
    if (!isLoading) {
      fetchCaseDetail();
    }
  }, []);

  if (isLoading) {
    return (
      <div className="case-detail">
        <h1 data-testid="case-detail-heading">Case Details</h1>
        <h2>
          <span className="case-number" title="Case Number">
            {caseId}
          </span>
        </h2>
        <p data-testid="loading-indicator">Loading...</p>
      </div>
    );
  } else {
    return (
      <>
        <div className="case-detail">
          <h1 data-testid="case-detail-heading">{caseDetail.caseTitle}</h1>
          <h2>
            <span className="case-number" title="Case Number">
              {caseDetail.caseId}
            </span>
          </h2>

          <div className="case-card-list">
            <div className="date-information padding-bottom-4 case-card">
              <h3>Dates</h3>
              <div className="date-list">
                <ul className="usa-list usa-list--unstyled">
                  <li>
                    <span className="case-detail-item-name">Filed:</span>
                    <span className="case-detail-item-value">{caseDetail.dateFiled}</span>
                  </li>
                  <li>
                    <span className="case-detail-item-name">Closed by court:</span>
                    <span className="case-detail-item-value">{caseDetail.dateClosed}</span>
                  </li>
                </ul>
              </div>
            </div>
            <div className="assigned-staff-information padding-bottom-4 case-card">
              <h3>Assigned Staff</h3>
              <div className="assigned-staff-list">
                <ul className="usa-list usa-list--unstyled">
                  {(caseDetail.assignedStaff as Array<StaffType>)?.map(
                    (staff: StaffType, idx: number) => {
                      return (
                        <li key={idx}>
                          <span className="case-detail-item-name">{staff.name}:</span>
                          <span className="case-detail-item-value">{staff.type}</span>
                        </li>
                      );
                    },
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }
};
