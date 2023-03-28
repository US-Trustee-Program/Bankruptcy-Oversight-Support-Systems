import { useState, useEffect } from 'react';
import Api, { ResponseData } from '../models/api';
import './CaseList.scss';

type caseType = {
  CASE_DIV: number;
  CASE_YEAR: number;
  CASE_NUMBER: number;
  CURR_CASE_CHAPT: string;
  GROUP_DESIGNATOR: string;
  STAFF1_PROF_CODE: number;
  STAFF1_PROF_FIRST_NAME: string;
  STAFF1_PROF_LAST_NAME: string;
  STAFF1_PROF_TYPE: string;
  STAFF1_PROF_TYPE_DESC: string;
  STAFF2_PROF_CODE: number;
  STAFF2_PROF_FIRST_NAME: string;
  STAFF2_PROF_LAST_NAME: string;
  STAFF2_PROF_TYPE: string;
  STAFF2_PROF_TYPE_DESC: string;
  HEARING_CODE: string;
  HEARING_DISP: string;
};

export const CaseList = () => {
  const api = new Api();
  const [caseList, setCaseList] = useState<ResponseData>({
    message: '',
    count: 0,
    body: [{}],
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [staff1Label, setStaff1Label] = useState<string>('');
  const [staff2Label, setStaff2Label] = useState<string>('');

  useEffect(() => {
    const fetchList = async () => {
      setIsLoading(true);
      api.list('/cases').then((res) => {
        (res.body as []).forEach((row) => {
          if (row['CURR_CASE_CHAPT'] == '11') {
            setStaff1Label('Trial Attorney');
            setStaff2Label('Auditor');
          }
        });
        setCaseList(res);
        setIsLoading(false);
      });
    };

    if (!isLoading) {
      fetchList();
    }
  }, [caseList.count > 0]);

  if (isLoading) {
    return (
      <div className="case-list">
        <h1>Case List</h1>
        <p>Loading...</p>
      </div>
    );
  } else {
    return (
      <div className="case-list">
        <h1>Case List</h1>
        <table>
          <thead>
            <tr className="staff-headings">
              <th colSpan={5}></th>
              <th colSpan={4} className="staff-label">
                Staff 1 {staff1Label}
              </th>
              <th colSpan={4} className="staff-label">
                Staff 2 {staff2Label}
              </th>
              <th colSpan={2}></th>
            </tr>
          </thead>
          <thead>
            <tr className="base-headings">
              <th>Case Div</th>
              <th>Case Year</th>
              <th>Case Number</th>
              <th>Chapter</th>
              <th>Group Designator</th>
              <th>Professional Code</th>
              <th>First Name</th>
              <th>Last Name</th>
              <th>Type</th>
              <th>Professional Code</th>
              <th>First Name</th>
              <th>Last Name</th>
              <th>Type</th>
              <th>Hearing Code</th>
              <th>Hearing Disposition</th>
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
                  <td>{theCase.GROUP_DESIGNATOR}</td>
                  <td>{theCase.STAFF1_PROF_CODE}</td>
                  <td>{theCase.STAFF1_PROF_FIRST_NAME}</td>
                  <td>{theCase.STAFF1_PROF_LAST_NAME}</td>
                  <td>{theCase.STAFF1_PROF_TYPE}</td>
                  <td>{theCase.STAFF2_PROF_CODE}</td>
                  <td>{theCase.STAFF2_PROF_FIRST_NAME}</td>
                  <td>{theCase.STAFF2_PROF_LAST_NAME}</td>
                  <td>{theCase.STAFF2_PROF_TYPE}</td>
                  <td>{theCase.HEARING_CODE}</td>
                  <td>{theCase.HEARING_DISP}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    );
  }
};
