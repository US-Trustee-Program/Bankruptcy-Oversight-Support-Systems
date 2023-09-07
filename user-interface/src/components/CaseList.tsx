import React, { useState, useEffect } from 'react';
import { useAppSelector } from '../store/store';
import Api from '../models/api';
import { CaseListResponseData } from '../type-declarations/api';
import './CaseList.scss';
import MockApi from '../models/chapter11-mock.api.cases';

type caseType = {
  caseNumber: string;
  currentChapterFileDate: number;
  currentCaseChapter: string;
  debtor1Name: string;
  hearingCode: string;
  hearingDate: number;
  hearingDisposition: string;
  hearingDescription: string;
  hearingTime: number;
  staff1ProfName: string;
  staff1ProfDescription: string;
  staff2ProfName: string;
  staff2ProfDescription: string;
};

export const CaseList = () => {
  const api = import.meta.env['CAMS_PA11Y'] ? MockApi : Api;
  const user = useAppSelector((state) => state.user.user);
  const [caseList, setCaseList] = useState<CaseListResponseData>({
    message: '',
    count: 0,
    body: {
      staff1Label: '',
      staff2Label: '',
      caseList: [{}],
    },
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);

  let name = 'any staff';
  if (user.id > 0) {
    name = `${user.firstName} ${user.lastName}`;
  }

  // temporarily hard code a chapter, until we provide a way for the user to select one
  const chapter = '11';

  const fetchList = async () => {
    setIsLoading(true);
    api
      .list('/cases', {
        chapter,
        professional_id: user.id === 0 ? '' : user.id,
      })
      .then((res) => {
        setCaseList(res as CaseListResponseData);
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
        <h1>Case List</h1>
        <p>Loading...</p>
      </div>
    );
  } else {
    return (
      <div className="case-list">
        <h1 data-testid="case-list-heading">
          Case List for {name} chapter {chapter}
        </h1>
        <table className="case-list usa-table">
          <thead>
            <tr className="case-headings">
              <th>Case Number</th>
              <th>Debtor Name</th>
              <th>Current Chapter Date</th>
              <th>Hearing Code</th>
              <th>Hearing Date and Time</th>
              <th>Hearing Disposition</th>
              <th>{caseList.body.staff1Label}</th>
              <th>{caseList.body.staff2Label}</th>
            </tr>
          </thead>
          <tbody data-testid="case-list-table-body">
            {caseList.count > 0 &&
              (caseList.body.caseList as Array<caseType>).map((theCase: caseType, idx: number) => {
                const chapterStr = theCase.currentChapterFileDate.toString();
                const chapterYear = chapterStr.substring(0, 4);
                const chapterMonth = chapterStr.substring(4, 6);
                const chapterDay = chapterStr.substring(6, 8);
                const chapterDateStr = `${chapterMonth}/${chapterDay}/${chapterYear}`;

                let hearingDateStr = '',
                  hearingYear = '',
                  hearingMonth = '',
                  hearingDay = '',
                  hearingTimeStr = '',
                  hearingHour = 0,
                  hearingHourStr = '',
                  timeFormat = '',
                  hearingMinute = '',
                  hearingDateTimeStr = '';

                if (theCase.hearingDate > 0) {
                  hearingDateStr = theCase.hearingDate.toString();
                  hearingYear = hearingDateStr.substring(0, 4);
                  hearingMonth = hearingDateStr.substring(4, 6);
                  hearingDay = hearingDateStr.substring(6, 8);
                  hearingDateTimeStr = `${hearingMonth}/${hearingDay}/${hearingYear}`;
                }
                if (theCase.hearingTime > 0) {
                  hearingTimeStr = theCase.hearingTime.toString();
                  if (theCase.hearingTime < 1000) {
                    hearingMinute = hearingTimeStr.substring(1, 3);
                    hearingHour = hearingTimeStr.substring(0, 1) as unknown as number;
                  } else {
                    hearingMinute = hearingTimeStr.substring(2, 4);
                    hearingHour = hearingTimeStr.substring(0, 2) as unknown as number;
                  }
                  timeFormat = 'am';
                  if (hearingHour > 12) {
                    timeFormat = 'pm';
                    hearingHour -= 12;
                  }
                  hearingHourStr = hearingHour.toString();
                  hearingDateTimeStr += ` ${hearingHourStr}:${hearingMinute} ${timeFormat}`;
                }

                return (
                  <tr key={idx}>
                    <td>{theCase.caseNumber}</td>
                    <td>{theCase.debtor1Name}</td>
                    <td>{chapterDateStr}</td>
                    <td>{theCase.hearingCode}</td>
                    <td>{hearingDateTimeStr}</td>
                    <td>{theCase.hearingDisposition}</td>
                    <td>{theCase.staff1ProfName}</td>
                    <td>{theCase.staff2ProfName}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    );
  }
};
