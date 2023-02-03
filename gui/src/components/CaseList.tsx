import React, { useState, useEffect } from 'react';
import Api, { ResponseData } from '../models/api';

type caseType = {
  caseid: number;
  chapter: number;
  analyst: string;
};

//export const CaseList: React.FC<caseType> = () => {
export const CaseList = () => {
  const api = new Api();
  const [caseList, setCaseList] = useState<ResponseData>({
    message: '',
    count: 0,
    body: [{}],
  });

  useEffect(() => {
    async function fetchList() {
      setCaseList(await api.list('/cases'));
    }

    fetchList();
  });

  return (
    <div>
      <h1>Case List</h1>
      <table>
        <thead>
          <tr>
            <th>Case Number</th>
            <th>Chapter</th>
            <th>Analyst</th>
          </tr>
        </thead>
        <tbody>
          {(caseList.body as Array<caseType>).map((theCase: caseType, idx: number) => (
            <tr key={idx}>
              <td>{theCase.caseid}</td>
              <td>Chapter {theCase.chapter}</td>
              <td>{theCase.analyst}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
