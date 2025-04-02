import DocumentTitle from '@/lib/components/cams/DocumentTitle/DocumentTitle';
import { MainContent } from '@/lib/components/cams/MainContent/MainContent';
import ScreenInfoButton from '@/lib/components/cams/ScreenInfoButton';
import { Stop } from '@/lib/components/Stop';
import Modal from '@/lib/components/uswds/modal/Modal';
import { STAFF_ASSIGNMENT_FILTER_ENABLED } from '@/lib/hooks/UseFeatureFlags';
import SearchResults from '@/search-results/SearchResults';
import { StaffAssignmentHeader } from '../header/StaffAssignmentHeader';
import AssignAttorneyModal from '../modal/AssignAttorneyModal';
import { StaffAssignmentViewModel } from './staffAssignmentViewModel';
import ComboBox from '@/lib/components/combobox/ComboBox';

export type StaffAssignmentScreenViewProps = {
  viewModel: StaffAssignmentViewModel;
};

export function StaffAssignmentScreenView(props: StaffAssignmentScreenViewProps) {
  const { viewModel } = props;
  const showAssignments = viewModel.hasValidPermission && viewModel.hasAssignedOffices;

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
          {viewModel.featureFlags[STAFF_ASSIGNMENT_FILTER_ENABLED] && (
            <>
              <h3>Filters</h3>
              <section className="staff-assignment-filter-container">
                {viewModel.officeAssignees.length > 0 &&
                  viewModel.officeAssigneesError === false && (
                    <ComboBox
                      id="staff-assignees"
                      options={viewModel.assigneesToComboOptions(viewModel.officeAssignees)}
                      onUpdateSelection={viewModel.handleFilterAssignee}
                      label="Assigned Attorney"
                      ariaDescription=""
                      aria-live="off"
                      multiSelect={false}
                    />
                  )}
              </section>
            </>
          )}
          {showAssignments && (
            <SearchResults
              id="search-results"
              searchPredicate={viewModel.getPredicateByUserContextWithFilter(
                viewModel.session!.user,
                viewModel.staffAssignmentFilter,
              )}
              noResultsMessage="No cases currently assigned."
              header={StaffAssignmentHeader}
              row={viewModel.StaffAssignmentRowClosure}
            ></SearchResults>
          )}
        </div>
        <div className="grid-col-1"></div>
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
