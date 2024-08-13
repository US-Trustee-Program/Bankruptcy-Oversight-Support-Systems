import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';
import { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import Modal from '@/lib/components/uswds/modal/Modal';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import { ToggleModalButton } from '@/lib/components/uswds/modal/ToggleModalButton';
import LocalStorage from '@/lib/utils/local-storage';
import { CasesSearchPredicate } from '@common/api/search';
import { CamsRole } from '@common/cams/roles';
import { getCamsUserReference } from '@common/cams/session';
import { AttorneyUser, CamsUser } from '@common/cams/users';
import { useEffect, useRef, useState } from 'react';
import { SearchResults, SearchResultsRowProps } from '@/search-results/SearchResults';
import { StaffAssignmentHeader } from './StaffAssignmentHeader';
import { StaffAssignmentRow } from './StaffAssignmentRow';
import './StaffAssignmentScreen.scss';
import AssignAttorneyModal, {
  AssignAttorneyModalRef,
  CallBackProps,
} from './modal/AssignAttorneyModal';
import Alert, { AlertRefType, UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import AttorneysApi from '@/lib/models/attorneys-api';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';

function getPredicateByUserContext(user: CamsUser): CasesSearchPredicate {
  const predicate: CasesSearchPredicate = {
    divisionCodes: user.offices?.map((office) => office.courtDivisionCode),
  };

  if (user.roles?.includes(CamsRole.TrialAttorney)) {
    predicate.assignments = [getCamsUserReference(user)];
  }

  return predicate;
}

export const StaffAssignmentScreen = () => {
  const screenTitle = 'Staff Assignment';

  const infoModalRef = useRef(null);
  const infoModalId = 'info-modal';
  const session = LocalStorage.getSession();

  const [attorneyList, setAttorneyList] = useState<AttorneyUser[]>([]);

  const [assignmentAlert, setAssignmentAlert] = useState<{
    message: string;
    type: UswdsAlertStyle;
    timeOut: number;
  }>({ message: '', type: UswdsAlertStyle.Success, timeOut: 8 });

  const assignmentAlertRef = useRef<AlertRefType>(null);
  const assignmentModalRef = useRef<AssignAttorneyModalRef>(null);
  const assignmentModalId = 'assign-attorney-modal';

  function StaffAssignmentRowClosure(props: SearchResultsRowProps) {
    return StaffAssignmentRow({
      ...props,
      options: { modalId: assignmentModalId, modalRef: assignmentModalRef },
    });
  }

  if (!session || !session.user.offices) {
    return <>Invalid user expectation</>;
  }
  const searchPredicate = getPredicateByUserContext(session.user);

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
      assignmentAlertRef.current?.show();
    } else if (bCase) {
      const messageArr = [];
      const addedAssignments = selectedAttorneyList.filter(
        (el) => !previouslySelectedList.includes(el),
      );
      const removedAssignments = previouslySelectedList.filter(
        (el) => !selectedAttorneyList.includes(el),
      );

      if (addedAssignments.length > 0) {
        messageArr.push(
          `${addedAssignments.map((attorney) => attorney.name).join(', ')} assigned to`,
        );
      }
      if (removedAssignments.length > 0) {
        messageArr.push(
          `${removedAssignments.map((attorney) => attorney.name).join(', ')} unassigned from`,
        );
      }

      const alertMessage =
        messageArr.join(' case and ') + ` case ${getCaseNumber(bCase.caseId)} ${bCase.caseTitle}.`;

      setAssignmentAlert({ message: alertMessage, type: UswdsAlertStyle.Success, timeOut: 8 });
      assignmentAlertRef.current?.show();

      assignmentModalRef.current?.hide();
    }
  }

  const fetchAttorneys = () => {
    AttorneysApi.getAttorneys()
      .then((attorneys) => {
        setAttorneyList(attorneys);
      })
      .catch((reason) => {
        setAssignmentAlert({
          message: reason.message,
          type: UswdsAlertStyle.Error,
          timeOut: 0,
        });
        assignmentAlertRef.current?.show();
      });
  };

  const infoModalActionButtonGroup = {
    modalId: infoModalId,
    modalRef: infoModalRef as React.RefObject<ModalRefType>,
    cancelButton: {
      label: 'Return',
      uswdsStyle: UswdsButtonStyle.Default,
    },
  };

  useEffect(() => {
    fetchAttorneys();
  }, []);

  return (
    <div className="my-cases case-list">
      <div className="grid-row grid-gap-lg">
        <div className="grid-col-1"></div>
        <div className="grid-col-10">
          <div className="screen-heading">
            <h1 data-testid="case-list-heading">{screenTitle}</h1>
            <ToggleModalButton
              toggleAction={'open'}
              modalId={''}
              modalRef={infoModalRef}
              uswdsStyle={UswdsButtonStyle.Unstyled}
            >
              <IconLabel label={'Information'} icon={'info'}></IconLabel>
            </ToggleModalButton>
          </div>
          <Alert
            message={assignmentAlert.message}
            type={assignmentAlert.type}
            role="status"
            ref={assignmentAlertRef}
            timeout={assignmentAlert.timeOut}
          />
          <SearchResults
            id="search-results"
            searchPredicate={searchPredicate}
            noResultsMessage="No cases currently assigned."
            header={StaffAssignmentHeader}
            row={StaffAssignmentRowClosure}
          ></SearchResults>
        </div>
        <div className="grid-col-1"></div>
      </div>
      <Modal
        ref={infoModalRef}
        modalId={infoModalId}
        className="assign-attorney-modal"
        heading="My Cases - Using This Page"
        content={<>TODO: We need new copy for this....</>}
        actionButtonGroup={infoModalActionButtonGroup}
      ></Modal>
      <AssignAttorneyModal
        ref={assignmentModalRef}
        attorneyList={attorneyList}
        modalId={`${assignmentModalId}`}
        callBack={updateCase}
      ></AssignAttorneyModal>
    </div>
  );
};
