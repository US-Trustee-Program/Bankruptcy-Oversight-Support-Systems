import { StaffAssignmentControls } from './staffAssignmentControls';

export function useStaffAssignmentControlsMock(): StaffAssignmentControls {
  const infoModalRef = {
    current: {
      show: () => {},
      hide: () => {},
      buttons: {
        current: {
          disableSubmitButton: (_state: boolean) => {},
        },
      },
    },
  };

  const assignmentModalRef = {
    current: {
      show: () => {},
      hide: () => {},
      buttons: {
        current: {
          disableSubmitButton: (_state: boolean) => {},
        },
      },
    },
  };

  const filterRef = {
    current: {
      refresh: () => {},
    },
  };

  return {
    assignmentModalRef,
    infoModalRef,
    filterRef,
  };
}
