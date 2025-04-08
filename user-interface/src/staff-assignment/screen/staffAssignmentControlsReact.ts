import { useRef } from 'react';
import { AssignAttorneyModalRef } from '../modal/AssignAttorneyModal';
import { StaffAssignmentControls } from './staffAssignmentControls';
import { StaffAssignmentFilterRef } from '../filters/StaffAssignmentFilter';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';

export function useStaffAssignmentControlsReact(): StaffAssignmentControls {
  const infoModalRef = useRef<ModalRefType>(null);
  const assignmentModalRef = useRef<AssignAttorneyModalRef>(null);
  const filterRef = useRef<StaffAssignmentFilterRef>(null);

  return {
    assignmentModalRef,
    infoModalRef,
    filterRef,
  };
}
