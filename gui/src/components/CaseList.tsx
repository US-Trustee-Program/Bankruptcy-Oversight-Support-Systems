import { useState, useEffect } from 'react';
import Api, { ResponseData } from '../models/api';
import './CaseList.scss';

type caseType = {
  CASE_DIV: number;
  CASE_YEAR: number;
  CASE_NUMBER: number;
  CURR_CASE_CHAPT: string;
  STAFF1_PROF_CODE: number;
  STAFF2_PROF_CODE: number;
};

export const CaseList = () => {
  const api = new Api();
  const [caseList, setCaseList] = useState<ResponseData>({
    message: '',
    count: 0,
    body: [{}],
  });
  let isWaiting = false;

  useEffect(() => {
    const fetchList = async () => {
      isWaiting = true;
      api.list('/cases').then((res) => {
        setCaseList(res);
        isWaiting = false;
      });
    };

    if (!isWaiting) {
      fetchList();
    }
  }, [caseList.count > 0]);

  return (
    <div className="case-list">
      <h1>Case List</h1>
      <table>
        <thead>
          <tr>
            <th>Case Div</th>
            <th>Case Year</th>
            <th>Case Number</th>
            <th>Chapter</th>
            <th>Staff 1</th>
            <th>Staff 2</th>
          </tr>
        </thead>
        <tbody>
          {caseList.count > 0 &&
            (caseList.body as Array<caseType>).map((theCase: caseType, idx: number) => (
              <tr key={idx}>
                <td>{theCase.CASE_DIV}</td>
                <td>{theCase.CASE_YEAR}</td>
                <td>{theCase.CASE_NUMBER}</td>
                <td>{theCase.CURR_CASE_CHAPT}</td>
                <td>{theCase.STAFF1_PROF_CODE}</td>
                <td>{theCase.STAFF2_PROF_CODE}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
};
