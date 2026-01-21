import DocumentTitle from '@/lib/components/cams/DocumentTitle/DocumentTitle';
import { MainContent } from '@/lib/components/cams/MainContent/MainContent';
import ScreenInfoButton from '@/lib/components/cams/ScreenInfoButton';
import { Stop } from '@/lib/components/Stop';
import Modal from '@/lib/components/uswds/modal/Modal';
import SearchResults from '@/search-results/SearchResults';
import { StaffAssignmentHeader } from '../header/StaffAssignmentHeader';
import AssignAttorneyModal from '../modal/AssignAttorneyModal';
import StaffAssignmentFilter from '../filters/StaffAssignmentFilter';
import { StaffAssignmentScreenViewProps } from './StaffAssignment.types';
import { UswdsAlertStyle } from '@/lib/components/uswds/Alert';

export function StaffAssignmentScreenView(props: Readonly<StaffAssignmentScreenViewProps>) {
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
        <div className="grid-col-12">
          <div className="screen-heading">
            <h1 data-testid="case-list-heading">
              {viewModel.screenTitle}
              <ScreenInfoButton
                infoModalRef={viewModel.infoModalRef}
                modalId={viewModel.infoModalId}
              />
            </h1>
          </div>
          {!viewModel.hasValidPermission && (
            <Stop
              id="forbidden-alert"
              title="Forbidden"
              message="You do not have permission to assign staff to cases in CAMS."
              asError
            ></Stop>
          )}
          {viewModel.hasValidPermission && !viewModel.hasAssignedOffices && (
            <Stop
              id="no-office"
              title="No Office Assigned"
              message="You cannot assign staff to cases because you are not currently assigned to a USTP office in Active Directory."
              showHelpDeskContact
            ></Stop>
          )}
          {showAssignments && (
            <>
              <StaffAssignmentFilter
                ref={viewModel.filterRef}
                handleFilterAssignee={viewModel.handleFilterAssignee}
              />
              <SearchResults
                id="search-results"
                searchPredicate={searchPredicate}
                noResultsAlertProps={noResultsAlertProps}
                header={StaffAssignmentHeader}
                row={viewModel.StaffAssignmentRowClosure}
              ></SearchResults>
            </>
          )}
        </div>
      </div>
      <Modal
        ref={viewModel.infoModalRef}
        modalId={viewModel.infoModalId}
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
        actionButtonGroup={viewModel.infoModalActionButtonGroup}
      ></Modal>
      <AssignAttorneyModal
        ref={viewModel.assignmentModalRef}
        modalId={`${viewModel.assignmentModalId}`}
        assignmentChangeCallback={viewModel.handleAssignmentChange}
      ></AssignAttorneyModal>
    </MainContent>
  );
}
