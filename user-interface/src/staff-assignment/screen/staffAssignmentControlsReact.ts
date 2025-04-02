import { useRef } from 'react';
import { StaffAssignmentFilterRef } from '../filters/StaffAssignmentFilter';
import { AssignAttorneyModalRef } from '../modal/AssignAttorneyModal';
import { StaffAssignmentControls } from './staffAssignmentControls';

export function useStaffAssignmentControlsReact(): StaffAssignmentControls {
  const filterRef = useRef<StaffAssignmentFilterRef>(null);
  const infoModalRef = useRef(null);
  const assignmentModalRef = useRef<AssignAttorneyModalRef>(null);

  const fetchAssignees = () => {
    filterRef.current?.fetchAssignees();
  };

  return {
    assignmentModalRef,
    filterRef,
    infoModalRef,

    fetchAssignees,
  };
}
