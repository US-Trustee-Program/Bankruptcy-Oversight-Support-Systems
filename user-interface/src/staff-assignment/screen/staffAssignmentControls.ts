import { RefObject } from 'react';
import { AssignAttorneyModalRef } from '../modal/AssignAttorneyModal';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import { CamsUserReference } from '@common/cams/users';

export type StaffAssignmentScreenFilter = {
  assignee: CamsUserReference;
};

interface StaffAssignmentControls {
  infoModalRef: React.RefObject<ModalRefType>;
  assignmentModalRef: RefObject<AssignAttorneyModalRef>;
}

export type { StaffAssignmentControls };
