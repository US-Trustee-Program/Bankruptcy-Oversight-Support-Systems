import './StaffAssignmentFilter.scss';

import ComboBox, { ComboOption } from '@/lib/components/combobox/ComboBox';
import useApi2 from '@/lib/hooks/UseApi2';
import LocalStorage from '@/lib/utils/local-storage';
import { CamsSession } from '@common/cams/session';
import { CamsUserReference, Staff } from '@common/cams/users';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { ResponseBody } from '../../../../common/dist/api/response';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';

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
  return Array.from(assigneeMap.values()).sort((a, b) => (a.name < b.name ? -1 : 1));
}

export type StaffAssignmentScreenFilter = {
  assignee: CamsUserReference;
};

export type StaffAssignmentFilterRef = {
  fetchAssignees: () => void;
};

export interface StaffAssignmentFilterProps {
  id?: string;
  onFilterAssigneeChange?: (assignee: CamsUserReference | undefined) => void;
}

function _StaffAssignmentFilter(
  props: StaffAssignmentFilterProps,
  ref: React.Ref<StaffAssignmentFilterRef>,
) {
  const { id: idInput, onFilterAssigneeChange } = props;
  const api = useApi2();
  const id = idInput ? `staff-assignment-filter-${idInput}` : 'staff-assignment-filter';
  const session = LocalStorage.getSession();
  const globalAlert = useGlobalAlert();
  const [officeAssigneesError, setOfficeAssigneesError] = useState<boolean>(false);
  const [officeAssignees, setOfficeAssignees] = useState<Staff[]>([]);

  async function handleSelectedAssignees(assignees: ComboOption[]) {
    if (onFilterAssigneeChange) {
      if (assignees[0]) {
        const newStaff: CamsUserReference = {
          id: assignees[0].value,
          name: assignees[0].label,
        };
        onFilterAssigneeChange(newStaff);
      } else {
        onFilterAssigneeChange(undefined);
      }
    }
  }

  function fetchAssignees() {
    if (session) {
      getOfficeAssignees(api.getOfficeAssignees, session)
        .then((assignees) => {
          setOfficeAssignees(assignees);
          setOfficeAssigneesError(false);
        })
        .catch((_e) => {
          setOfficeAssigneesError(true);
          globalAlert?.error('There was a problem getting the list of assignees.');
        });
    }
  }

  useImperativeHandle(ref, () => {
    return {
      fetchAssignees,
    };
  });

  useEffect(() => {
    fetchAssignees();
  }, []);

  return (
    <div id={id} data-testid={id} className="staff-assignment-filters">
      {officeAssignees.length > 0 && officeAssigneesError === false && (
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
