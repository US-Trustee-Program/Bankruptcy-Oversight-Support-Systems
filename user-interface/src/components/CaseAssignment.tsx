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
        const sortedList = chapter15Response?.body?.caseList?.sort((a, b): number => {
          const recordA: Chapter15Type = a as Chapter15Type;
          const recordB: Chapter15Type = b as Chapter15Type;
          if (recordA.dateFiled < recordB.dateFiled) {
            return 1;
          } else if (recordA.dateFiled > recordB.dateFiled) {
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

  const openModal = (theCase: Chapter15Type, openerId: string) => {
    setBCase(theCase);
    setModalOpenerId(openerId);
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
          <table className="case-list">
            <thead>
              <tr className="case-headings">
                <th>Case Number</th>
                <th>Case Title (Debtor)</th>
                <th>Filing Date</th>
                <th>Assigned Attorney</th>
              </tr>
            </thead>
            <tbody data-testid="case-assignment-table-body">
              {caseList.length > 0 &&
                (caseList as Array<Chapter15Type>).map((theCase: Chapter15Type, idx: number) => {
                  return (
                    <tr key={idx}>
                      <td>
                        <span className="mobile-title">Case Number:</span>
                        {theCase.caseNumber}
                      </td>
                      <td>
                        <span className="mobile-title">Case Title (Debtor):</span>
                        {theCase.caseTitle}
                      </td>
                      <td>
                        <span className="mobile-title">Filing Date:</span>
                        {theCase.dateFiled}
                      </td>
                      <td>
                        <span className="mobile-title">Assigned Attorney:</span>
                        {theCase.attorneyList?.length != undefined || (
                          <ToggleModalButton
                            className="case-assignment-modal-toggle"
                            id={`assign-attorney-btn-${idx}`}
                            buttonId={`${idx}`}
                            toggleAction="open"
                            modalId={`${modalId}`}
                            modalRef={modalRef}
                            onClick={() => openModal(theCase, `assign-attorney-btn-${idx}`)}
                          >
                            Assign
                          </ToggleModalButton>
                        )}
                        {theCase.attorneyList?.map((attorney) => (
                          <>
                            {attorney}
                            <br />
                          </>
                        ))}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
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
