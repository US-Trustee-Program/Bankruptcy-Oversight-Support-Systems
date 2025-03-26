import ComboBox, { ComboOption } from '@/lib/components/combobox/ComboBox';
import useApi2 from '@/lib/hooks/UseApi2';
import LocalStorage from '@/lib/utils/local-storage';
import { CamsSession } from '@common/cams/session';
import { CamsUserReference, Staff } from '@common/cams/users';
import { forwardRef, useEffect, useState } from 'react';
import { ResponseBody } from '../../../../common/dist/api/response';

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

export async function getOfficeAssignees(
  apiFunction: (office: string) => Promise<ResponseBody<Staff[]>>,
  session: CamsSession,
): Promise<Staff[]> {
  const offices = session?.user?.offices;
  const assigneeMap: Map<string, Staff> = new Map();
  if (offices) {
    for (const office of offices) {
      const assignees = await apiFunction(office.officeCode);
      assignees.data.forEach((assignee) => {
        if (!assigneeMap.has(assignee.id)) {
          assigneeMap.set(assignee.id, assignee);
        }
      });
    }
  }
  return Array.from(assigneeMap.values());
}

export type StaffAssignmentScreenFilter = {
  assignee: CamsUserReference;
};

export type StaffAssignmentFilterRef = {
  focusEditButton: (noteId: string) => void;
};

export interface StaffAssignmentFilterProps {
  id?: string;
  onFilterAssigneeChange?: (assignee: Staff) => void;
}

function _StaffAssignmentFilter(
  props: StaffAssignmentFilterProps,
  _ref: React.Ref<StaffAssignmentFilterRef>,
) {
  const { id, onFilterAssigneeChange } = props;
  const api = useApi2();
  const testId = `staff-assignment-filter${id ? `-${id}` : ''}`;
  const session = LocalStorage.getSession();

  const [officeAssignees, setOfficeAssignees] = useState<Staff[]>([]);

  async function handleSelectedAssignees(assignees: ComboOption[]) {
    if (onFilterAssigneeChange && assignees[0]) {
      const newStaff: CamsUserReference = {
        id: assignees[0].value,
        name: assignees[0].label,
      };
      onFilterAssigneeChange(newStaff);
    }
  }

  useEffect(() => {
    if (session) {
      getOfficeAssignees(api.getOfficeAssignees, session)
        .then((assignees) => setOfficeAssignees(assignees))
        .catch((_e) => {
          // handle error
        });
    }
  }, []);

  return (
    <div id={id ?? ''} data-testid={testId}>
      {officeAssignees.length && (
        <ComboBox
          id="staff-assignees"
          options={assigneesToComboOptions(officeAssignees)}
          onUpdateSelection={handleSelectedAssignees}
          label="Assigned Attorney"
          ariaDescription=""
          aria-live="off"
          multiSelect={false}
        />
      )}
    </div>
  );
}

const StaffAssignmentFilter = forwardRef(_StaffAssignmentFilter);

export default StaffAssignmentFilter;
