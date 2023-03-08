import { useState, useEffect } from 'react';
import Api, { ResponseData } from '../models/api';
import './CaseList.scss';

type caseType = {
  cases_id: number;
  chapters_id: number;
  idi_date: string;
  idi_status: string;
  staff1: string;
  staff2: string;
};

//export const CaseList: React.FC<caseType> = () => {
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
            <th>Case Number</th>
            <th>Chapter</th>
            <th>Staff 1</th>
            <th>Staff 2</th>
            <th>IDI Date</th>
            <th>IDI Status</th>
          </tr>
        </thead>
        <tbody>
          {caseList.count > 0 &&
            (caseList.body as Array<caseType>).map((theCase: caseType, idx: number) => (
              <tr key={idx}>
                <td>{theCase.cases_id}</td>
                <td>Chapter {theCase.chapters_id}</td>
                <td>{theCase.staff1}</td>
                <td>{theCase.staff2}</td>
                <td>{theCase.idi_date}</td>
                <td>{theCase.idi_status}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
};
