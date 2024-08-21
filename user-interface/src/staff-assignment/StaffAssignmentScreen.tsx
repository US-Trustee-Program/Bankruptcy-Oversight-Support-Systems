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
import { StaffAssignmentRow } from './StaffAssignmentRow/StaffAssignmentRow';
import './StaffAssignmentScreen.scss';
import AssignAttorneyModal, { AssignAttorneyModalRef } from './modal/AssignAttorneyModal';
import { CamsRole } from '@common/cams/roles';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';

function getPredicateByUserContext(user: CamsUser): CasesSearchPredicate {
  const predicate: CasesSearchPredicate = {
    limit: DEFAULT_SEARCH_LIMIT,
    offset: DEFAULT_SEARCH_OFFSET,
    divisionCodes: user.offices?.map((office) => office.courtDivisionCode),
  };

  if (!predicate.divisionCodes) {
    predicate.divisionCodes = [];
  }

  return predicate;
}

export const StaffAssignmentScreen = () => {
  const screenTitle = 'Staff Assignment';

  const infoModalRef = useRef(null);
  const infoModalId = 'info-modal';
  const session = LocalStorage.getSession();

  const assignmentModalRef = useRef<AssignAttorneyModalRef>(null);
  const assignmentModalId = 'assign-attorney-modal';

  const globalAlert = useGlobalAlert();

  function StaffAssignmentRowClosure(props: SearchResultsRowProps) {
    return StaffAssignmentRow({
      ...props,
      options: { modalId: assignmentModalId, modalRef: assignmentModalRef },
    });
  }

  if (!session?.user?.roles?.includes(CamsRole.CaseAssignmentManager)) {
    globalAlert?.error('Invalid Permissions');
    return <></>;
  }
  const searchPredicate = getPredicateByUserContext(session.user);

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
        content={
          <>
            Staff Assignment allows you to assign staff members to unassigned cases. You can also
            change any previously-made assignments. Use the filters to find the case you wish to
            assign, and add or change the staff members assigned to that case. You can view details
            about a case by clicking on its case number.
          </>
        }
        actionButtonGroup={infoModalActionButtonGroup}
      ></Modal>
      <AssignAttorneyModal
        ref={assignmentModalRef}
        modalId={`${assignmentModalId}`}
      ></AssignAttorneyModal>
    </div>
  );
};
