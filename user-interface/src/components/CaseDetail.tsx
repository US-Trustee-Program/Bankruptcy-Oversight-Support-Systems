import './CaseDetail.scss';
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Api from '../models/api';
import MockApi from '../models/chapter15-mock.api.cases';

export const CaseDetail = () => {
  const { caseId } = useParams();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const api = import.meta.env['CAMS_PA11Y'] === 'true' ? MockApi : Api;
  const caseTitle = 'ABC Company, Inc.';
  const caseNumber = '34-56789';
  interface CaseDateType {
    name: string;
    tooltip: string;
    date: string;
  }
  interface AssignedStaffType {
    name: string;
    type: string;
  }

  const caseDate: CaseDateType[] = [
    {
      name: 'Filed',
      tooltip: 'Case Filed Date',
      date: '11-23-2022',
    },
    {
      name: 'Closed by Court',
      tooltip: 'Case Closed by Court Date',
      date: '11-25-2022',
    },
  ];

  const assignedStaff: AssignedStaffType[] = [
    {
      name: 'Jane Doe',
      type: 'Trial Attorney',
    },
    {
      name: 'John Doe',
      type: 'Trial Attorney',
    },
  ];

  const fetchCaseDetail = async () => {
    setIsLoading(true);
    api.get(`/cases/${caseId}`, {}).then(() => {
      return;
    });
  };

  useEffect(() => {
    if (!isLoading) {
      fetchCaseDetail();
    }
  }, []);

  return (
    <>
      <div className="case-detail">
        <h1>{caseTitle}</h1>
        <h2>
          <span className="case-number" title="Case Number">
            {caseNumber}
          </span>
        </h2>

        <div className="case-card-list">
          <div className="date-information padding-bottom-4 case-card">
            <h3>Dates</h3>
            <div className="date-list">
              <ul className="usa-list usa-list--unstyled">
                {(caseDate as Array<CaseDateType>).map((dateItem: CaseDateType, idx: number) => {
                  return (
                    <li key={idx} title={dateItem.tooltip}>
                      <span className="date-name">{dateItem.name}:</span>
                      <span className="date-value">{dateItem.date}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
          <div className="assigned-staff-information padding-bottom-4 case-card">
            <h3>Assigned Staff</h3>
            <div className="assigned-staff-list">
              <ul className="usa-list usa-list--unstyled">
                {(assignedStaff as Array<AssignedStaffType>).map(
                  (staff: AssignedStaffType, idx: number) => {
                    return (
                      <li key={idx}>
                        <span className="date-name">{staff.name}:</span>
                        <span className="date-value">{staff.type}</span>
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
};
