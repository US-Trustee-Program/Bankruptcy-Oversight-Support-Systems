import { Ref, RefObject } from 'react';
import { StaffAssignmentFilterRef } from '../filters/StaffAssignmentFilter';
import { AssignAttorneyModalRef } from '../modal/AssignAttorneyModal';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';

interface StaffAssignmentControls {
  filterRef: Ref<StaffAssignmentFilterRef>;
  infoModalRef: React.RefObject<ModalRefType>;
  assignmentModalRef: RefObject<AssignAttorneyModalRef>;

  fetchAssignees: () => void;
}

export type { StaffAssignmentControls };
