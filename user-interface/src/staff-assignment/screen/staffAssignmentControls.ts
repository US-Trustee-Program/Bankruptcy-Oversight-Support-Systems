import { RefObject } from 'react';
import { AssignAttorneyModalRef } from '../modal/AssignAttorneyModal';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import { StaffAssignmentFilterRef } from '../filters/StaffAssignmentFilter';

interface StaffAssignmentControls {
  infoModalRef: React.RefObject<ModalRefType>;
  assignmentModalRef: RefObject<AssignAttorneyModalRef>;
  filterRef: RefObject<StaffAssignmentFilterRef>;
}

export type { StaffAssignmentControls };
