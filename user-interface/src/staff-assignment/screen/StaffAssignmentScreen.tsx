import { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import Modal from '@/lib/components/uswds/modal/Modal';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import LocalStorage from '@/lib/utils/local-storage';
import {
  CasesSearchPredicate,
  DEFAULT_SEARCH_LIMIT,
  DEFAULT_SEARCH_OFFSET,
} from '@common/api/search';
import { CamsUser, getCourtDivisionCodes } from '@common/cams/users';
import { useRef } from 'react';
import SearchResults, { SearchResultsRowProps } from '@/search-results/SearchResults';
import { StaffAssignmentHeader } from '../header/StaffAssignmentHeader';
import { StaffAssignmentRow } from '../row/StaffAssignmentRow';
import './StaffAssignmentScreen.scss';
import AssignAttorneyModal, { AssignAttorneyModalRef } from '../modal/AssignAttorneyModal';
import { CamsRole } from '@common/cams/roles';
import ScreenInfoButton from '@/lib/components/cams/ScreenInfoButton';
import DocumentTitle from '@/lib/components/cams/DocumentTitle/DocumentTitle';
import { MainContent } from '@/lib/components/cams/MainContent/MainContent';
import useFeatureFlags, {
  CHAPTER_ELEVEN_ENABLED,
  CHAPTER_TWELVE_ENABLED,
} from '@/lib/hooks/UseFeatureFlags';
import { Stop } from '@/lib/components/Stop';

function getChapters(): string[] {
  const chapters = ['15'];
  const featureFlags = useFeatureFlags();
  if (featureFlags[CHAPTER_ELEVEN_ENABLED]) chapters.push('11');
  if (featureFlags[CHAPTER_TWELVE_ENABLED]) chapters.push('12');
  return chapters;
}

function getPredicateByUserContext(user: CamsUser): CasesSearchPredicate {
  const predicate: CasesSearchPredicate = {
    limit: DEFAULT_SEARCH_LIMIT,
    offset: DEFAULT_SEARCH_OFFSET,
    divisionCodes: getCourtDivisionCodes(user),
    chapters: getChapters(),
    excludeChildConsolidations: true,
  };

  return predicate;
}

export const StaffAssignmentScreen = () => {
  const screenTitle = 'Staff Assignment';

  const infoModalRef = useRef(null);
  const infoModalId = 'info-modal';

  const assignmentModalRef = useRef<AssignAttorneyModalRef>(null);
  const assignmentModalId = 'assign-attorney-modal';

  function StaffAssignmentRowClosure(props: SearchResultsRowProps) {
    return StaffAssignmentRow({
      ...props,
      options: { modalId: assignmentModalId, modalRef: assignmentModalRef },
    });
  }

  const session = LocalStorage.getSession();
  const hasValidPermission = session?.user?.roles?.includes(CamsRole.CaseAssignmentManager);
  const hasAssignedOffices = session?.user?.offices && session?.user?.offices.length > 0;
  const showAssignments = hasValidPermission && hasAssignedOffices;

  const infoModalActionButtonGroup = {
    modalId: infoModalId,
    modalRef: infoModalRef as React.RefObject<ModalRefType>,
    cancelButton: {
      label: 'Return',
      uswdsStyle: UswdsButtonStyle.Default,
    },
  };

  return (
    <MainContent className="staff-assignment case-list">
      <DocumentTitle name="Staff Assignment" />
      <div className="grid-row grid-gap-lg">
        <div className="grid-col-1"></div>
        <div className="grid-col-10">
          <div className="screen-heading">
            <h1 data-testid="case-list-heading">{screenTitle}</h1>
            <ScreenInfoButton infoModalRef={infoModalRef} modalId={infoModalId} />
          </div>
          {!hasValidPermission && (
            <Stop
              id="forbidden-alert"
              title="Forbidden"
              message="You do not have permission to assign staff to cases in CAMS."
              asError
            ></Stop>
          )}
          {hasValidPermission && !hasAssignedOffices && (
            <Stop
              id="no-office"
              title="No Office Assigned"
              message="You cannot assign staff to cases because you are not currently assigned to a USTP office in Active Directory."
              showHelpDeskContact
            ></Stop>
          )}
          {showAssignments && (
            <SearchResults
              id="search-results"
              searchPredicate={getPredicateByUserContext(session!.user)}
              noResultsMessage="No cases currently assigned."
              header={StaffAssignmentHeader}
              row={StaffAssignmentRowClosure}
            ></SearchResults>
          )}
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
    </MainContent>
  );
};
