import './CaseAssignmentScreen.scss';
import { useState, useEffect, useRef } from 'react';
import Api from '../lib/models/api';
import { Chapter15Type, Chapter15CaseListResponseData } from '@/lib/type-declarations/chapter-15';
import MockApi from '../lib/models/chapter15-mock.api.cases';
import { ToggleModalButton } from '@/lib/components/uswds/modal/ToggleModalButton';
import AssignAttorneyModal, {
  AssignAttorneyModalRefType,
  CallBackProps,
} from './AssignAttorneyModal';
import Alert, { AlertRefType, UswdsAlertStyle } from '../lib/components/uswds/Alert';
import AttorneysApi from '../lib/models/attorneys-api';
import { Attorney } from '@/lib/type-declarations/attorneys';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';
import { formatDate } from '@/lib/utils/datetime';
import Icon from '@/lib/components/uswds/Icon';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { CaseNumber } from '@/lib/components/CaseNumber';

const modalId = 'assign-attorney-modal';

const TABLE_TRANSFER_TIMEOUT = 10;

export const CaseAssignment = () => {
  const modalRef = useRef<AssignAttorneyModalRefType>(null);
  const alertRef = useRef<AlertRefType>(null);
  const api = import.meta.env['CAMS_PA11Y'] === 'true' ? MockApi : Api;
  const screenTitle = 'Bankruptcy Cases';
  const regionId = 2;
  const officeName = 'Manhattan';
  const subTitle = `Region ${regionId} (${officeName} Office)`;
  const [unassignedCaseList, setUnassignedCaseList] = useState<Array<Chapter15Type>>([]);
  const [assignedCaseList, setAssignedCaseList] = useState<Array<Chapter15Type>>([]);
  const [caseListLoadError, setCaseListLoadError] = useState(false);
  const [assignmentAlert, setAssignmentAlert] = useState<{
    message: string;
    type: UswdsAlertStyle;
    timeOut: number;
  }>({ message: '', type: UswdsAlertStyle.Success, timeOut: 8 });
  const [attorneyList, setAttorneyList] = useState<Attorney[]>([]);
  const [inTableTransferMode, setInTableTransferMode] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  let isFetching = false;

  function sortByDate(a: Chapter15Type, b: Chapter15Type): number {
    if (a.dateFiled < b.dateFiled) {
      return 1;
    } else if (a.dateFiled > b.dateFiled) {
      return -1;
    } else {
      return 0;
    }
  }

  function sortByCaseId(a: Chapter15Type, b: Chapter15Type): number {
    if (a.caseId < b.caseId) {
      return 1;
    } else if (a.caseId > b.caseId) {
      return -1;
    } else {
      return 0;
    }
  }

  // TODO: figure out how we want to get cases and assignments
  const fetchCases = async () => {
    isFetching = true;
    await api
      .list('/cases')
      .then((res) => {
        const assignmentList: Chapter15Type[] = [];
        const nonAssignmentList: Chapter15Type[] = [];

        const chapter15Response = res as Chapter15CaseListResponseData;
        chapter15Response?.body?.caseList.forEach((theCase) => {
          const caseNode = theCase as Chapter15Type;
          if (caseNode.assignments && caseNode.assignments.length > 0) {
            assignmentList.push(caseNode);
          } else {
            nonAssignmentList.push(caseNode);
          }
        });
        const sortedAssignedList = assignmentList.sort(sortByDate);
        const sortedNonAssignedList = nonAssignmentList.sort(sortByDate);

        setUnassignedCaseList(sortedNonAssignedList || []);
        setAssignedCaseList(sortedAssignedList || []);

        isFetching = false;
        setIsLoading(false);
      })
      .catch((reason) => {
        isFetching = false;
        setIsLoading(false);
        setAssignmentAlert({
          message: reason.message,
          type: UswdsAlertStyle.Error,
          timeOut: 0,
        });
        alertRef.current?.show();
        setCaseListLoadError(true);
      });
  };

  const fetchAttorneys = () => {
    AttorneysApi.getAttorneys().then((response) => {
      const attorneys = response.map((atty) => {
        const attorney = new Attorney(atty.firstName, atty.lastName, atty.office);
        if (atty.middleName !== undefined) attorney.middleName = atty.middleName;
        if (atty.generation !== undefined) attorney.generation = atty.generation;
        if (atty.caseLoad !== undefined) attorney.caseLoad = atty.caseLoad;
        return attorney;
      });
      setAttorneyList(attorneys);
    });
  };

  function updateCase({
    bCase,
    selectedAttorneyList,
    previouslySelectedList,
    status,
    apiResult,
  }: CallBackProps) {
    if (status === 'error') {
      setAssignmentAlert({
        message: (apiResult as Error).message,
        type: UswdsAlertStyle.Error,
        timeOut: 8,
      });
      alertRef.current?.show();
    } else if (bCase) {
      const messageArr = [];
      const addedAssignments = selectedAttorneyList.filter(
        (el) => !previouslySelectedList.includes(el),
      );
      const removedAssignments = previouslySelectedList.filter(
        (el) => !selectedAttorneyList.includes(el),
      );

      if (addedAssignments.length > 0) {
        messageArr.push(`${addedAssignments.map((attorney) => attorney).join(', ')} assigned to`);
      }
      if (removedAssignments.length > 0) {
        messageArr.push(
          `${removedAssignments.map((attorney) => attorney).join(', ')} unassigned from`,
        );
      }

      bCase.assignments = selectedAttorneyList;
      setInTableTransferMode(bCase.caseId);

      // Modify the unassigned list.
      const tempUnassignedCaseList = unassignedCaseList.filter((aCase) => {
        return aCase.caseId !== bCase.caseId;
      });
      if (selectedAttorneyList.length === 0) tempUnassignedCaseList.push(bCase);
      tempUnassignedCaseList.sort(sortByDate).sort(sortByCaseId);
      setUnassignedCaseList(tempUnassignedCaseList);

      // Modify the assigned list.
      const tempAssignedCaseList = assignedCaseList.filter((aCase) => {
        return aCase.caseId !== bCase.caseId;
      });
      if (selectedAttorneyList.length > 0) tempAssignedCaseList.push(bCase);
      tempAssignedCaseList.sort(sortByDate).sort(sortByCaseId);
      setAssignedCaseList(tempAssignedCaseList);

      const alertMessage =
        messageArr.join(' case and ') + ` case ${getCaseNumber(bCase.caseId)} ${bCase.caseTitle}.`;

      setAssignmentAlert({ message: alertMessage, type: UswdsAlertStyle.Success, timeOut: 8 });
      alertRef.current?.show();

      setTimeout(() => {
        setInTableTransferMode('');
      }, TABLE_TRANSFER_TIMEOUT * 1000);
    }
  }

  // Fetch all cases from CAMS API
  useEffect(() => {
    if (isFetching) return;
    fetchCases();
    fetchAttorneys();
  }, []);

  return (
    <>
      <div className="case-assignment case-list">
        <div className="grid-row grid-gap-lg">
          <div className="grid-col-1"></div>
          <div className="grid-col-10">
            <Alert
              message={assignmentAlert.message}
              type={assignmentAlert.type}
              role="status"
              slim={true}
              ref={alertRef}
              timeout={assignmentAlert.timeOut}
            />
            <h1 data-testid="case-list-heading">{screenTitle}</h1>
            <h2 data-testid="case-list-subtitle">{subTitle}</h2>
            {isLoading && <LoadingSpinner id="loading-indicator" caption="Loading cases..." />}
            {caseListLoadError && (
              <div>
                We are having trouble reviewing case information at this time. Please refresh your
                browser.
              </div>
            )}
            {!isLoading && (
              <>
                {unassignedCaseList.length > 0 && (
                  <div className="usa-table-container--scrollable" tabIndex={0}>
                    <table
                      className="case-list usa-table usa-table--striped"
                      data-testid="unassigned-table"
                    >
                      <caption>Unassigned Cases</caption>
                      <thead>
                        <tr className="case-headings">
                          <th scope="col" role="columnheader">
                            Case Number
                          </th>
                          <th scope="col" role="columnheader" data-testid="chapter-table-header">
                            Chapter
                          </th>
                          <th scope="col" role="columnheader">
                            Case Title (Debtor)
                          </th>
                          <th
                            data-sortable
                            scope="col"
                            role="columnheader"
                            aria-sort="descending"
                            aria-label="Filing Date, sortable column, currently sorted descending"
                          >
                            Filing Date
                            <button
                              tabIndex={0}
                              className="usa-table__header__button"
                              title="Click to sort by Filing Date in ascending order."
                              disabled={true}
                            >
                              <svg
                                className="usa-icon"
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                              >
                                <g className="descending" fill="transparent">
                                  <path d="M17 17L15.59 15.59L12.9999 18.17V2H10.9999V18.17L8.41 15.58L7 17L11.9999 22L17 17Z"></path>
                                </g>
                                <g className="ascending" fill="transparent">
                                  <path
                                    transform="rotate(180, 12, 12)"
                                    d="M17 17L15.59 15.59L12.9999 18.17V2H10.9999V18.17L8.41 15.58L7 17L11.9999 22L17 17Z"
                                  ></path>
                                </g>
                                <g className="unsorted" fill="transparent">
                                  <polygon points="15.17 15 13 17.17 13 6.83 15.17 9 16.58 7.59 12 3 7.41 7.59 8.83 9 11 6.83 11 17.17 8.83 15 7.42 16.41 12 21 16.59 16.41 15.17 15"></polygon>
                                </g>
                              </svg>
                            </button>
                          </th>
                          <th scope="col" role="columnheader">
                            Assign Attorney
                          </th>
                        </tr>
                      </thead>
                      <tbody data-testid="unassigned-table-body">
                        {(unassignedCaseList as Array<Chapter15Type>).map(
                          (theCase: Chapter15Type, idx: number) => {
                            return (
                              <tr
                                key={idx}
                                className={
                                  theCase.caseId === inTableTransferMode
                                    ? 'in-table-transfer-mode'
                                    : ''
                                }
                              >
                                <td className="case-number">
                                  <span className="mobile-title">Case Number:</span>
                                  <CaseNumber caseNumber={theCase.caseId} />
                                </td>
                                <td className="chapter" data-testid={`${theCase.caseId}-chapter`}>
                                  <span className="mobile-title">Chapter:</span>
                                  {theCase.chapter}
                                </td>
                                <td className="case-title-column">
                                  <span className="mobile-title">Case Title (Debtor):</span>
                                  {theCase.caseTitle}
                                </td>
                                <td
                                  className="filing-date"
                                  data-sort-value={theCase.dateFiled}
                                  data-sort-active={true}
                                >
                                  <span className="mobile-title">Filing Date:</span>
                                  {formatDate(theCase.dateFiled)}
                                </td>
                                <td data-testid={`attorney-list-${idx}`} className="attorney-list">
                                  <span className="mobile-title">Assigned Attorney:</span>
                                  <ToggleModalButton
                                    className="case-assignment-modal-toggle"
                                    buttonIndex={`${idx}`}
                                    toggleAction="open"
                                    toggleProps={{
                                      bCase: theCase,
                                    }}
                                    modalId={`${modalId}`}
                                    modalRef={modalRef}
                                  >
                                    Assign
                                  </ToggleModalButton>
                                </td>
                              </tr>
                            );
                          },
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
                {assignedCaseList.length > 0 && (
                  <div className="usa-table-container--scrollable" tabIndex={0}>
                    <table className="case-list usa-table usa-table--striped">
                      <caption>Assigned Cases</caption>
                      <thead>
                        <tr className="case-headings">
                          <th scope="col" role="columnheader">
                            Case Number
                          </th>
                          <th scope="col" role="columnheader" data-testid="chapter-table-header">
                            Chapter
                          </th>
                          <th scope="col" role="columnheader">
                            Case Title (Debtor)
                          </th>
                          <th
                            data-sortable
                            scope="col"
                            role="columnheader"
                            aria-sort="descending"
                            aria-label="Filing Date, sortable column, currently sorted descending"
                          >
                            Filing Date
                            <button
                              tabIndex={0}
                              className="usa-table__header__button"
                              title="Click to sort by Filing Date in ascending order."
                              disabled={true}
                            >
                              <svg
                                className="usa-icon"
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                              >
                                <g className="descending" fill="transparent">
                                  <path d="M17 17L15.59 15.59L12.9999 18.17V2H10.9999V18.17L8.41 15.58L7 17L11.9999 22L17 17Z"></path>
                                </g>
                                <g className="ascending" fill="transparent">
                                  <path
                                    transform="rotate(180, 12, 12)"
                                    d="M17 17L15.59 15.59L12.9999 18.17V2H10.9999V18.17L8.41 15.58L7 17L11.9999 22L17 17Z"
                                  ></path>
                                </g>
                                <g className="unsorted" fill="transparent">
                                  <polygon points="15.17 15 13 17.17 13 6.83 15.17 9 16.58 7.59 12 3 7.41 7.59 8.83 9 11 6.83 11 17.17 8.83 15 7.42 16.41 12 21 16.59 16.41 15.17 15"></polygon>
                                </g>
                              </svg>
                            </button>
                          </th>
                          <th scope="col" role="columnheader">
                            Assigned Attorney
                          </th>
                        </tr>
                      </thead>
                      <tbody data-testid="assigned-table-body">
                        {(assignedCaseList as Array<Chapter15Type>).map(
                          (theCase: Chapter15Type, idx: number) => {
                            return (
                              <tr
                                key={idx}
                                className={
                                  theCase.caseId === inTableTransferMode
                                    ? 'in-table-transfer-mode'
                                    : ''
                                }
                              >
                                <td className="case-number">
                                  <span className="mobile-title">Case Number:</span>
                                  <CaseNumber caseNumber={theCase.caseId} />
                                </td>
                                <td className="chapter" data-testid={`${theCase.caseId}-chapter`}>
                                  <span className="mobile-title">Chapter:</span>
                                  {theCase.chapter}
                                </td>
                                <td className="case-title-column">
                                  <span className="mobile-title">Case Title (Debtor):</span>
                                  {theCase.caseTitle}
                                </td>
                                <td
                                  className="filing-date"
                                  data-sort-value={theCase.dateFiled}
                                  data-sort-active={true}
                                >
                                  <span className="mobile-title">Filing Date:</span>
                                  {formatDate(theCase.dateFiled)}
                                </td>
                                <td data-testid={`attorney-list-${idx}`} className="attorney-list">
                                  <div className="table-flex-container">
                                    <span className="mobile-title">Assigned Attorney:</span>
                                    <div className="attorney-list-container">
                                      {theCase.assignments?.map((attorney, key: number) => (
                                        <div key={key}>
                                          {attorney}
                                          <br />
                                        </div>
                                      ))}
                                    </div>
                                    <div className="table-column-toolbar">
                                      <ToggleModalButton
                                        className="case-assignment-modal-toggle"
                                        buttonIndex={`${idx}`}
                                        toggleAction="open"
                                        toggleProps={{
                                          bCase: theCase,
                                        }}
                                        modalId={`${modalId}`}
                                        modalRef={modalRef}
                                        title="edit assignments"
                                      >
                                        <Icon name="edit"></Icon>
                                      </ToggleModalButton>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            );
                          },
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="grid-col-1"></div>
        </div>
      </div>

      {attorneyList.length > 0 && (
        <AssignAttorneyModal
          ref={modalRef}
          attorneyList={attorneyList}
          modalId={`${modalId}`}
          callBack={updateCase}
        ></AssignAttorneyModal>
      )}
    </>
  );
};

export default CaseAssignment;
