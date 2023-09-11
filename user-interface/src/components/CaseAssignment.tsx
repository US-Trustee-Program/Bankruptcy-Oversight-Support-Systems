import './CaseAssignment.scss';
import './CaseList.scss';
import React, { useState, useEffect, useRef } from 'react';
import Api from '../models/api';
import { Chapter15Type, Chapter15CaseListResponseData } from '../type-declarations/chapter-15';
import MockApi from '../models/chapter15-mock.api.cases';
import { ToggleModalButton } from './uswds/ToggleModalButton';
import AssignAttorneyModal, { CallBackProps } from './AssignAttorneyModal';
import { ModalRefType } from './uswds/Modal';
import Alert, { AlertRefType, UswdsAlertStyle } from './uswds/Alert';
import AttorneysApi from '../models/attorneys-api';
import { Attorney } from '../type-declarations/attorneys';

const modalId = 'assign-attorney-modal';

interface Chapter15Node extends Chapter15Type {
  sortableDateFiled: string;
}

export const CaseAssignment = () => {
  const modalRef = useRef<ModalRefType>(null);
  const alertRef = useRef<AlertRefType>(null);
  const api = import.meta.env['CAMS_PA11Y'] ? MockApi : Api;
  const screenTitle = 'Chapter 15 Bankruptcy Cases';
  const regionId = 2;
  const officeName = 'Manhattan';
  const subTitle = `Region ${regionId} (${officeName} Office)`;
  const [caseList, setCaseList] = useState<Array<object>>(Array<object>);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [caseListUpdated, setCaseListUpdated] = useState<boolean>(false);
  const [bCase, setBCase] = useState<Chapter15Type>();
  const [modalOpenerId, setModalOpenerId] = useState<string>('');
  const [assignmentAlert, setAssignmentAlert] = useState<{
    message: string;
    type: UswdsAlertStyle;
  }>({ message: '', type: UswdsAlertStyle.Success });
  const [attorneyList, setAttorneyList] = useState<Attorney[]>([]);

  // temporarily hard code a chapter, until we provide a way for the user to select one
  const chapter = '15';

  const fetchList = async () => {
    setIsLoading(true);
    api
      .list('/cases', {
        chapter,
      })
      .then((res) => {
        const chapter15Response = res as Chapter15CaseListResponseData;
        const sortedList = chapter15Response?.body?.caseList
          ?.map((theCase) => {
            const caseNode = theCase as Chapter15Node;
            const dateFiled = caseNode.dateFiled.split('-');
            // Filing date formatted in SQL query as MM-dd-yyyy (ISO is yyyy-MM-dd)
            // dateFiled[0] = month, dateFiled[1] = day, dateFiled[2] = year
            caseNode.sortableDateFiled = `${dateFiled[2]}${dateFiled[0]}${dateFiled[1]}`;
            return caseNode;
          })
          .sort((a, b): number => {
            const recordA: Chapter15Node = a as Chapter15Node;
            const recordB: Chapter15Node = b as Chapter15Node;
            if (recordA.sortableDateFiled < recordB.sortableDateFiled) {
              return 1;
            } else if (recordA.sortableDateFiled > recordB.sortableDateFiled) {
              return -1;
            } else {
              return 0;
            }
          });
        setCaseList(sortedList || []);
        setIsLoading(false);
      })
      .catch((reason) => {
        console.log((reason as Error).message);
      });
  };

  useEffect(() => {
    if (!isLoading) {
      fetchList();
    }
  }, [caseList.length > 0, chapter]);

  useEffect(() => {
    if (caseListUpdated) {
      setCaseListUpdated(false);
    }
  }, [caseListUpdated]);

  useEffect(() => {
    AttorneysApi.getAttorneys().then((response) => {
      const attorneys = response.map((atty) => {
        const attorney = new Attorney(atty.firstName, atty.lastName, atty.office);
        if (atty.middleName !== undefined) attorney.middleName = atty.middleName;
        if (atty.generation !== undefined) attorney.generation = atty.generation;
        if (atty.caseCount !== undefined) attorney.caseCount = atty.caseCount;
        return attorney;
      });
      setAttorneyList(attorneys);
    });
  }, [attorneyList.length > 0]);

  const onOpenModal = (theCase: Chapter15Type, openerId: string) => {
    setBCase(theCase);
    setModalOpenerId(openerId); // do we need this?
    //modalRef.current?.show();
    return theCase;
  };

  function updateCase({ bCase, selectedAttorneyList, status, apiResult }: CallBackProps) {
    if (status === 'error') {
      setAssignmentAlert({ message: (apiResult as Error).message, type: UswdsAlertStyle.Error });
      alertRef.current?.show();
    } else if (selectedAttorneyList.length > 0) {
      const tempCaseList = caseList;
      tempCaseList.forEach((theCase) => {
        if (bCase?.caseNumber === (theCase as Chapter15Type).caseNumber) {
          (theCase as Chapter15Type).attorneyList = selectedAttorneyList.map((atty) => {
            return atty;
          });
        }
      });
      if (bCase) {
        const alertMessage = `${selectedAttorneyList
          .map((attorney) => attorney)
          .join(', ')} assigned to case ${bCase.caseNumber} ${bCase.caseTitle}`;
        setAssignmentAlert({ message: alertMessage, type: UswdsAlertStyle.Success });
        alertRef.current?.show();
      }
      setCaseList(tempCaseList);
      setCaseListUpdated(true);
    }
  }

  if (isLoading) {
    return (
      <div className="case-assignment case-list">
        <h1>{screenTitle}</h1>
        <h2>{subTitle}</h2>
        <p data-testid="loading-indicator">Loading...</p>
      </div>
    );
  } else {
    return (
      <>
        <div className="case-assignment case-list">
          <h1 data-testid="case-list-heading">{screenTitle}</h1>
          <h2 data-testid="case-list-subtitle">{subTitle}</h2>
          <Alert
            message={assignmentAlert.message}
            type={assignmentAlert.type}
            role="status"
            slim={true}
            ref={alertRef}
            timeout={4}
          />
          <div className="usa-table-container--scrollable" tabIndex={0}>
            <table className="case-list usa-table usa-table--striped">
              <thead>
                <tr className="case-headings">
                  <th scope="col" role="columnheader">
                    Case Number
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
              <tbody data-testid="case-assignment-table-body">
                {caseList.length > 0 &&
                  (caseList as Array<Chapter15Node>).map((theCase: Chapter15Node, idx: number) => {
                    return (
                      <tr key={idx}>
                        <td className="case-number">
                          <span className="mobile-title">Case Number:</span>
                          {theCase.caseNumber}
                        </td>
                        <td className="case-title-column">
                          <span className="mobile-title">Case Title (Debtor):</span>
                          {theCase.caseTitle}
                        </td>
                        <td
                          className="filing-date"
                          data-sort-value={theCase.sortableDateFiled}
                          data-sort-active={true}
                        >
                          <span className="mobile-title">Filing Date:</span>
                          {theCase.dateFiled}
                        </td>
                        <td data-testid={`attorney-list-${idx}`} className="attorney-list">
                          <span className="mobile-title">Assigned Attorney:</span>
                          {theCase.attorneyList?.length != undefined || (
                            <ToggleModalButton
                              className="case-assignment-modal-toggle"
                              id={`assign-attorney-btn-${idx}`}
                              buttonId={`${idx}`}
                              toggleAction="open"
                              modalId={`${modalId}`}
                              modalRef={modalRef}
                              onClick={() => onOpenModal(theCase, `assign-attorney-btn-${idx}`)}
                            >
                              Assign
                            </ToggleModalButton>
                          )}
                          {theCase.attorneyList?.map((attorney, key: number) => (
                            <div key={key}>
                              {attorney}
                              <br />
                            </div>
                          ))}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
        {attorneyList.length > 0 && (
          <AssignAttorneyModal
            ref={modalRef}
            attorneyList={attorneyList}
            bCase={bCase}
            modalId={`${modalId}`}
            openerId={modalOpenerId}
            callBack={updateCase}
          ></AssignAttorneyModal>
        )}
      </>
    );
  }
};
