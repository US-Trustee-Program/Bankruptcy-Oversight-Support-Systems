import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';
import { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import Modal from '@/lib/components/uswds/modal/Modal';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import { ToggleModalButton } from '@/lib/components/uswds/modal/ToggleModalButton';
import LocalStorage from '@/lib/utils/local-storage';
import {
  CasesSearchPredicate,
  DEFAULT_SEARCH_LIMIT,
  DEFAULT_SEARCH_OFFSET,
} from '@common/api/search';
import { CamsUser } from '@common/cams/users';
import { useRef } from 'react';
import { SearchResults, SearchResultsRowProps } from '@/search-results/SearchResults';
import { StaffAssignmentHeader } from './StaffAssignmentHeader';
import { StaffAssignmentRow } from './StaffAssignmentRow';
import './StaffAssignmentScreen.scss';
import AssignAttorneyModal, {
  AssignAttorneyModalRef,
  CallBackProps,
} from './modal/AssignAttorneyModal';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import { UswdsAlertStyle } from '@/lib/components/uswds/Alert';

function getPredicateByUserContext(user: CamsUser): CasesSearchPredicate {
  const predicate: CasesSearchPredicate = {
    limit: DEFAULT_SEARCH_LIMIT,
    offset: DEFAULT_SEARCH_OFFSET,
    divisionCodes: user.offices?.map((office) => office.courtDivisionCode),
  };

  return predicate;
}

export const StaffAssignmentScreen = () => {
  const screenTitle = 'Staff Assignment';

  const globalAlert = useGlobalAlert();

  const infoModalRef = useRef(null);
  const infoModalId = 'info-modal';
  const session = LocalStorage.getSession();

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
      globalAlert?.show({
        message: (apiResult as Error).message,
        type: UswdsAlertStyle.Error,
        timeout: 8,
      });
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

      globalAlert?.show({ message: alertMessage, type: UswdsAlertStyle.Success, timeout: 8 });

      assignmentModalRef.current?.hide();
    }
  }

  const infoModalActionButtonGroup = {
    modalId: infoModalId,
    modalRef: infoModalRef as React.RefObject<ModalRefType>,
    cancelButton: {
      label: 'Return',
      uswdsStyle: UswdsButtonStyle.Default,
    },
  };

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
        className="staff-assignment-info"
        heading="Staff Assignment - Using This Page"
        content={<>TODO: We need new copy for this....</>}
        actionButtonGroup={infoModalActionButtonGroup}
      ></Modal>
      <AssignAttorneyModal
        ref={assignmentModalRef}
        modalId={`${assignmentModalId}`}
        callBack={updateCase}
      ></AssignAttorneyModal>
    </div>
  );
};
