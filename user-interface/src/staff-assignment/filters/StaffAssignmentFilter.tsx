import ComboBox, { ComboOption } from '@/lib/components/combobox/ComboBox';
import useApi2 from '@/lib/hooks/UseApi2';
import { Staff } from '@common/cams/users';
import { forwardRef, useEffect, useState } from 'react';

export function assigneesToComboOptions(officeAssignees: Staff[]): ComboOption[] {
  const comboOptions: ComboOption[] = [];
  officeAssignees.forEach((assignee) => {
    comboOptions.push({
      value: assignee.id,
      label: assignee.name,
    });
  });
  return comboOptions;
}

export type StaffAssignmentFilterRef = {
  focusEditButton: (noteId: string) => void;
};

export interface StaffAssignmentFilterProps {
  id?: string;
  officeCode: string;
}

function _StaffAssignmentFilter(
  props: StaffAssignmentFilterProps,
  _ref: React.Ref<StaffAssignmentFilterRef>,
) {
  const { id, officeCode } = props;
  const api = useApi2();
  const testId = `staff-assignment-filter${id ? `-${id}` : ''}`;

  const [officeAssignees, setOfficeAssignees] = useState<Staff[]>([]);

  async function handleSelectedAssignees() {}

  async function handleAssigneesClear() {}

  async function getOfficeAssignees() {
    const assignees = await api.getOfficeAssignees(officeCode);
    setOfficeAssignees(assignees.data);
  }

  useEffect(() => {
    getOfficeAssignees();
  }, []);

  return (
    <div id={id ?? ''} data-testid={testId}>
      {officeAssignees && (
        <ComboBox
          id="staff-assignees"
          options={assigneesToComboOptions(officeAssignees)}
          onClose={handleSelectedAssignees}
          onPillSelection={handleSelectedAssignees}
          onUpdateSelection={handleAssigneesClear}
          label="Filter by Assigned Attorneys"
          ariaDescription="Select multiple options. Results will update when the dropdown is closed."
          aria-live="off"
          multiSelect={true}
        />
      )}
    </div>
  );
}

const StaffAssignmentFilter = forwardRef(_StaffAssignmentFilter);

export default StaffAssignmentFilter;
