import { Ref } from 'react';
import { StaffAssignmentFilterRef } from '../filters/StaffAssignmentFilter';
import { AssignAttorneyModalRef } from '../modal/AssignAttorneyModal';

interface StaffAssignmentControls {
  filterRef: Ref<StaffAssignmentFilterRef>;
  infoModalRef: Ref<React.MutableRefObject<null>>;
  assignmentModalRef: Ref<AssignAttorneyModalRef>;

  fetchAssignees: () => void;
}

export type { StaffAssignmentControls };
