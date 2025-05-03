import DocumentTitle from '@/lib/components/cams/DocumentTitle/DocumentTitle';
import { MainContent } from '@/lib/components/cams/MainContent/MainContent';
import ScreenInfoButton from '@/lib/components/cams/ScreenInfoButton';
import { Stop } from '@/lib/components/Stop';
import { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import Modal from '@/lib/components/uswds/modal/Modal';
import { STAFF_ASSIGNMENT_FILTER_ENABLED } from '@/lib/hooks/UseFeatureFlags';
import SearchResults from '@/search-results/SearchResults';

import StaffAssignmentFilter from '../filters/StaffAssignmentFilter';
import { StaffAssignmentHeader } from '../header/StaffAssignmentHeader';
import AssignAttorneyModal from '../modal/AssignAttorneyModal';
import { StaffAssignmentScreenViewProps } from './StaffAssignment.types';

export function StaffAssignmentScreenView(props: StaffAssignmentScreenViewProps) {
  const { viewModel } = props;
  const showAssignments = viewModel.hasValidPermission && viewModel.hasAssignedOffices;

  const searchPredicate = viewModel.getPredicateByUserContextWithFilter(
    viewModel.session!.user,
    viewModel.staffAssignmentFilter,
  );

  const noResultsAlertProps = searchPredicate.includeOnlyUnassigned
    ? {
        message: 'There are no more cases to be assigned.',
        title: 'All Cases Assigned',
        type: UswdsAlertStyle.Info,
      }
    : {
        message: 'There are no cases currently assigned.',
        title: 'No Cases Assigned',
        type: UswdsAlertStyle.Warning,
      };

  return (
    <MainContent className="staff-assignment case-list">
      <DocumentTitle name="Staff Assignment" />
      <div className="grid-row grid-gap-lg">
        <div className="grid-col-1"></div>
        <div className="grid-col-10">
          <div className="screen-heading">
            <h1 data-testid="case-list-heading">{viewModel.screenTitle}</h1>
            <ScreenInfoButton
              infoModalRef={viewModel.infoModalRef}
              modalId={viewModel.infoModalId}
            />
          </div>
          {!viewModel.hasValidPermission && (
            <Stop
              asError
              id="forbidden-alert"
              message="You do not have permission to assign staff to cases in CAMS."
              title="Forbidden"
            ></Stop>
          )}
          {viewModel.hasValidPermission && !viewModel.hasAssignedOffices && (
            <Stop
              id="no-office"
              message="You cannot assign staff to cases because you are not currently assigned to a USTP office in Active Directory."
              showHelpDeskContact
              title="No Office Assigned"
            ></Stop>
          )}
          {viewModel.featureFlags[STAFF_ASSIGNMENT_FILTER_ENABLED] && (
            <StaffAssignmentFilter
              handleFilterAssignee={viewModel.handleFilterAssignee}
              ref={viewModel.filterRef}
            />
          )}
          {showAssignments && (
            <SearchResults
              header={StaffAssignmentHeader}
              id="search-results"
              noResultsAlertProps={noResultsAlertProps}
              row={viewModel.StaffAssignmentRowClosure}
              searchPredicate={searchPredicate}
            ></SearchResults>
          )}
        </div>
        <div className="grid-col-1"></div>
      </div>
      <Modal
        actionButtonGroup={viewModel.infoModalActionButtonGroup}
        className="staff-assignment-info"
        content={
          <>
            Staff Assignment allows you to assign staff members to unassigned cases. You can also
            change any previously-made assignments. Use the filters to find the case you wish to
            assign, and add or change the staff members assigned to that case. You can view details
            about a case by clicking on its case number.
          </>
        }
        heading="Staff Assignment - Using This Page"
        modalId={viewModel.infoModalId}
        ref={viewModel.infoModalRef}
      ></Modal>
      <AssignAttorneyModal
        assignmentChangeCallback={viewModel.handleAssignmentChange}
        modalId={`${viewModel.assignmentModalId}`}
        ref={viewModel.assignmentModalRef}
      ></AssignAttorneyModal>
    </MainContent>
  );
}
