import ComboBox from '@/lib/components/combobox/ComboBox';
import { StaffAssignmentFilterViewModel } from './staffAssignmentFilterViewModel';
import { useEffect } from 'react';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';

type StaffAssignmentFilterViewProps = {
  viewModel: StaffAssignmentFilterViewModel;
};

function StaffAssignmentFilterView(props: StaffAssignmentFilterViewProps) {
  const globalAlert = useGlobalAlert();
  const { viewModel } = props;

  useEffect(() => {
    if (viewModel.officeAssigneesError) {
      globalAlert?.error('There was a problem getting the list of assignees.');
    }
  }, [viewModel.officeAssigneesError]);

  return (
    <div>
      <h3>Filters</h3>
      <section className="staff-assignment-filter-container">
        {viewModel.officeAssignees.length > 0 && viewModel.officeAssigneesError === false && (
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
    </div>
  );
}

export default StaffAssignmentFilterView;
