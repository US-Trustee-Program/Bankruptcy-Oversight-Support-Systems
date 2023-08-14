import { useState, useEffect, useRef } from 'react';
import Api from '../models/api';
import { Chapter15Type, Chapter15CaseListResponseData } from '../type-declarations/chapter-15';
import './CaseList.scss';
import MockApi from '../models/chapter15-mock.api.cases';
import { ToggleModalButton } from './uswds/ToggleModalButton';
import AssignAttorneyModal, { CallBackProps } from './AssignAttorneyModal';
import { ModalRefType } from './uswds/Modal';

const modalId = 'assign-attorney-modal';

export const CaseAssignment = () => {
  const modalRef = useRef<ModalRefType>(null);
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
        const sortedList = chapter15Response.body.caseList.sort((a, b): number => {
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
        setCaseList(sortedList);
        setIsLoading(false);
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

  const openModal = (theCase: Chapter15Type, openerId: string) => {
    setBCase(theCase);
    setModalOpenerId(openerId);
    modalRef.current?.show();
    return theCase;
  };

  function updateCase({ bCase, selectedAttorneyList }: CallBackProps) {
    console.log('bCase:', bCase);
    if (selectedAttorneyList.length > 0) {
      const tempCaseList = caseList;
      console.log('attorneyList:', selectedAttorneyList);
      tempCaseList.forEach((theCase) => {
        if (bCase?.caseNumber === (theCase as Chapter15Type).caseNumber) {
          (theCase as Chapter15Type).attorneyList = selectedAttorneyList;
        }
      });
      setCaseList(tempCaseList);
      setCaseListUpdated(true);
      console.log('tempCaseList:', tempCaseList);
    }
  }

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
      <>
        <div className="case-list">
          <h1 data-testid="case-list-heading">{screenTitle}</h1>
          <h2 data-testid="case-list-subtitle">{subTitle}</h2>
          <table>
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
                      <td>{theCase.caseNumber}</td>
                      <td>{theCase.caseTitle}</td>
                      <td>{theCase.dateFiled}</td>
                      <td>
                        {theCase.attorneyList?.length != undefined || (
                          <ToggleModalButton
                            className="case-assignment-modal-toggle"
                            id={`assign-attorney-btn-${idx}`}
                            toggleAction="open"
                            modalId={`${modalId}-${idx}`}
                            onClick={() => openModal(theCase, `assign-attorney-btn-${idx}`)}
                          >
                            Assign
                          </ToggleModalButton>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        <AssignAttorneyModal
          ref={modalRef}
          bCase={bCase}
          modalId={`${modalId}`}
          openerId={modalOpenerId}
          callBack={updateCase}
        ></AssignAttorneyModal>
      </>
    );
  }
};
