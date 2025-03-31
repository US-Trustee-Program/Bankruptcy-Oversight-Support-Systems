import './StaffAssignmentFilter.scss';

import ComboBox, { ComboOption } from '@/lib/components/combobox/ComboBox';
import useApi2 from '@/lib/hooks/UseApi2';
import LocalStorage from '@/lib/utils/local-storage';
import { CamsSession } from '@common/cams/session';
import { CamsUserReference, Staff } from '@common/cams/users';
import { useEffect, useState } from 'react';
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
  return Array.from(assigneeMap.values());
}

export type StaffAssignmentScreenFilter = {
  assignee: CamsUserReference;
};

export interface StaffAssignmentFilterProps {
  id?: string;
  onFilterAssigneeChange?: (assignee: Staff) => void;
}

export default function StaffAssignmentFilter(props: StaffAssignmentFilterProps) {
  const { id, onFilterAssigneeChange } = props;
  const api = useApi2();
  const testId = `staff-assignment-filter${id ? `-${id}` : ''}`;
  const session = LocalStorage.getSession();
  const globalAlert = useGlobalAlert();
  const [officeAssigneesError, setOfficeAssigneesError] = useState<boolean>(false);
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
        .then((assignees) => {
          setOfficeAssignees(assignees);
          setOfficeAssigneesError(false);
        })
        .catch((_e) => {
          setOfficeAssigneesError(true);
          globalAlert?.error('There was a problem getting the list of assignees.');
        });
    }
  }, []);

  return (
    <div id={id ?? ''} data-testid={testId} className="staff-assignment-filters">
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
