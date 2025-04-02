import { useRef } from 'react';
import { AssignAttorneyModalRef } from '../modal/AssignAttorneyModal';
import { StaffAssignmentControls } from './staffAssignmentControls';

export function useStaffAssignmentControlsReact(): StaffAssignmentControls {
  const infoModalRef = useRef(null);
  const assignmentModalRef = useRef<AssignAttorneyModalRef>(null);

  return {
    assignmentModalRef,
    infoModalRef,
  };
}
