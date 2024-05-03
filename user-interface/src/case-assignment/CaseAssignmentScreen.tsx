import { useState, useEffect, useRef } from 'react';
import { Chapter15Type, Chapter15CaseListResponseData } from '@/lib/type-declarations/chapter-15';
import AssignAttorneyModal, { AssignAttorneyModalRef, CallBackProps } from './AssignAttorneyModal';
import Alert, { AlertRefType, UswdsAlertStyle } from '../lib/components/uswds/Alert';
import AttorneysApi from '../lib/models/attorneys-api';
import { Attorney } from '@/lib/type-declarations/attorneys';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { useApi } from '@/lib/hooks/UseApi';
import { AssignAttorneyCasesTable } from './AssignAttorneyCasesTable';

const modalId = 'assign-attorney-modal';

const TABLE_TRANSFER_TIMEOUT = 10;

export const CaseAssignment = () => {
  const modalRef = useRef<AssignAttorneyModalRef>(null);
  const alertRef = useRef<AlertRefType>(null);
  const api = useApi();
  const screenTitle = 'Bankruptcy Cases';
  const regionId = 2;
  const officeName = 'Manhattan';
  const subTitle = `Region ${regionId} (${officeName} Office)`;
  const [caseList, setCaseList] = useState<Array<Chapter15Type>>([]);
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

  const fetchCases = async () => {
    isFetching = true;
    await api
      .list('/cases')
      .then((res) => {
        const chapter15Response = res as Chapter15CaseListResponseData;
        const assignmentList: Chapter15Type[] = chapter15Response?.body?.caseList ?? [];
        assignmentList.sort(sortByDate).sort(sortByCaseId);
        setCaseList(assignmentList);

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
    AttorneysApi.getAttorneys()
      .then((attorneys) => {
        setAttorneyList(attorneys);
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

      const updatedCaseList = caseList.filter((aCase) => {
        return aCase.caseId !== bCase.caseId;
      });
      updatedCaseList.push(bCase);
      updatedCaseList.sort(sortByDate).sort(sortByCaseId);
      setCaseList(updatedCaseList);

      const alertMessage =
        messageArr.join(' case and ') + ` case ${getCaseNumber(bCase.caseId)} ${bCase.caseTitle}.`;

      setAssignmentAlert({ message: alertMessage, type: UswdsAlertStyle.Success, timeOut: 8 });
      alertRef.current?.show();

      setTimeout(() => {
        setInTableTransferMode('');
      }, TABLE_TRANSFER_TIMEOUT * 1000);

      modalRef.current?.hide();
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
              <AssignAttorneyCasesTable
                caseList={caseList}
                modalId={modalId}
                modalRef={modalRef}
                inTableTransferMode={inTableTransferMode}
              />
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
