import ComboBox from '@/lib/components/combobox/ComboBox';
import { StaffAssignmentFilterViewProps } from './staffAssignmentFilter.types';

function StaffAssignmentFilterView(props: StaffAssignmentFilterViewProps) {
  const { viewModel } = props;

  return (
    <div>
      <section className="staff-assignment-filter-container">
        {viewModel.officeAssignees.length > 0 && viewModel.officeAssigneesError === false && (
          <ComboBox
            id="staff-assignees"
            options={viewModel.assigneesToComboOptions(viewModel.officeAssignees)}
            onUpdateSelection={viewModel.handleFilterAssignee}
            label="Assigned Attorney"
            ariaDescription="Filter the results by Attorney Name."
            aria-live="off"
            multiSelect={false}
            ref={viewModel.assigneesFilterRef}
          />
        )}
      </section>
    </div>
  );
}

export default StaffAssignmentFilterView;
