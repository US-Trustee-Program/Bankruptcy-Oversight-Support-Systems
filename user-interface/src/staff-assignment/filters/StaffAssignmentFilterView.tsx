import ComboBox from '@/lib/components/combobox/ComboBox';

import { StaffAssignmentFilterViewProps } from './staffAssignmentFilter.types';

function StaffAssignmentFilterView(props: StaffAssignmentFilterViewProps) {
  const { viewModel } = props;

  return (
    <div>
      <h3>Filters</h3>
      <section className="staff-assignment-filter-container">
        {viewModel.officeAssignees.length > 0 && viewModel.officeAssigneesError === false && (
          <ComboBox
            aria-live="off"
            ariaDescription="Filter the results by Attorney Name."
            id="staff-assignees"
            label="Assigned Attorney"
            multiSelect={false}
            onUpdateSelection={viewModel.handleFilterAssignee}
            options={viewModel.assigneesToComboOptions(viewModel.officeAssignees)}
            ref={viewModel.assigneesFilterRef}
          />
        )}
      </section>
    </div>
  );
}

export default StaffAssignmentFilterView;
