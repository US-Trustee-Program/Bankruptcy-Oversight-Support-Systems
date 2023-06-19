import { useState, useEffect } from 'react';
import Api, { Chapter15CaseListResponseData } from '../models/api';
import './CaseList.scss';
import MockApi from '../models/chapter15-mock.api.cases';

type chapter15Type = {
  caseNumber: string;
  caseTitle: string;
  dateFiled: string;
};

export const CaseAssignment = () => {
  const api = process.env['REACT_APP_PA11Y'] ? MockApi : Api;
  const screenTitle = 'Chapter 15 Bankruptcy Cases';
  const subTitle = 'Region 2 (Connecticut, New York, Vermont)';
  const [caseList, setCaseList] = useState<Chapter15CaseListResponseData>({
    message: '',
    count: 0,
    body: {
      caseList: [{}],
    },
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // temporarily hard code a chapter, until we provide a way for the user to select one
  const chapter = '15';

  const fetchList = async () => {
    setIsLoading(true);
    api
      .list('/cases', {
        chapter,
      })
      .then((res) => {
        setCaseList(res as Chapter15CaseListResponseData);
        setIsLoading(false);
      });
  };

  useEffect(() => {
    fetchList();

    if (!isLoading) {
      fetchList();
    }
  }, [caseList.count > 0, chapter]);

  if (isLoading) {
    return (
      <div className="case-list">
        <h1>{screenTitle}</h1>
        <h2>{subTitle}</h2>
        <p>Loading...</p>
      </div>
    );
  } else {
    return (
      <div className="case-list">
        <h1 data-testid="case-list-heading">{screenTitle}</h1>
        <h2>{subTitle}</h2>
        <table>
          <thead>
            <tr className="case-headings">
              <th>Case Number</th>
              <th>Case Title (Debtor)</th>
              <th>Filing Date</th>
            </tr>
          </thead>
          <tbody data-testid="case-assignment-table-body">
            {caseList.count > 0 &&
              (caseList.body.caseList as Array<chapter15Type>).map(
                (theCase: chapter15Type, idx: number) => {
                  return (
                    <tr key={idx}>
                      <td>{theCase.caseNumber}</td>
                      <td>{theCase.caseTitle}</td>
                      <td>{theCase.dateFiled}</td>
                    </tr>
                  );
                },
              )}
          </tbody>
        </table>
      </div>
    );
  }
};
