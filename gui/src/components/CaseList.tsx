import { useState, useEffect } from 'react';
import { useAppSelector } from '../store/store';
import Api, { ResponseData } from '../models/api';
import './CaseList.scss';

type caseType = {
  CASE_YEAR_AND_NUMBER: string;
  CURRENT_CHAPTER_FILE_DATE: number;
  CURR_CASE_CHAPT: string;
  DEBTOR1_NAME: string;
  HEARING_CODE: string;
  HEARING_DATE: number;
  HEARING_DISP: string;
  HEARING_TIME: number;
  STAFF1_PROF_NAME: string;
  STAFF1_PROF_TYPE_DESC: string;
  STAFF2_PROF_NAME: string;
  STAFF2_PROF_TYPE_DESC: string;
};

export const CaseList = () => {
  const user = useAppSelector((state) => state.user.user);
  const [caseList, setCaseList] = useState<ResponseData>({
    message: '',
    count: 0,
    body: [{}],
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [staff1Label, setStaff1Label] = useState<string>('');
  const [staff2Label, setStaff2Label] = useState<string>('');

  let name = 'any staff';
  if (user.id > 0) {
    name = `${user.firstName} ${user.lastName}`;
  }

  // temporarily hard code a chapter, until we provide a way for the user to select one
  const chapter = '11';

  const fetchList = async () => {
    setIsLoading(true);
    Api.list('/cases', {
      chapter,
      professionalId: user.id,
    }).then((res) => {
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
        <table>
          <thead>
            <tr className="case-headings">
              <th>Case Number</th>
              <th>Debtor Name</th>
              <th>Current Chapter Date</th>
              <th>Hearing Code</th>
              <th>Initial Hearing Date/Time</th>
              <th>Hearing Disposition</th>
              <th>{staff1Label}</th>
              <th>{staff2Label}</th>
            </tr>
          </thead>
          <tbody>
            {caseList.count > 0 &&
              (caseList.body as Array<caseType>).map((theCase: caseType, idx: number) => {
                const chapterStr = theCase.CURRENT_CHAPTER_FILE_DATE.toString();
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

                if (theCase.HEARING_DATE > 0) {
                  hearingDateStr = theCase.HEARING_DATE.toString();
                  hearingYear = hearingDateStr.substring(0, 4);
                  hearingMonth = hearingDateStr.substring(4, 6);
                  hearingDay = hearingDateStr.substring(6, 8);
                  hearingDateTimeStr = `${hearingMonth}/${hearingDay}/${hearingYear}`;
                }
                if (theCase.HEARING_TIME > 0) {
                  hearingTimeStr = theCase.HEARING_TIME.toString();
                  if (theCase.HEARING_TIME < 1000) {
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
                    <td>{theCase.CASE_YEAR_AND_NUMBER}</td>
                    <td>{theCase.DEBTOR1_NAME}</td>
                    <td>{chapterDateStr}</td>
                    <td>{theCase.HEARING_CODE}</td>
                    <td>{hearingDateTimeStr}</td>
                    <td>{theCase.HEARING_DISP}</td>
                    <td>{theCase.STAFF1_PROF_NAME}</td>
                    <td>{theCase.STAFF2_PROF_NAME}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    );
  }
};
