import { AttorneyUser, CamsUserReference } from '@common/cams/users';
import { deepEqual } from '@common/object-equality';
import Api2 from '@/lib/models/api2';
import { ResponseBody } from '@common/api/response';
import { CamsRole } from '@common/cams/roles';
import { getCamsUserReference } from '@common/cams/session';
import {
  AssignAttorneyModalStore,
  AssignAttorneyModalControls,
  AssignAttorneyModalUseCase,
  AssignAttorneyModalOpenProps,
} from './assignAttorneyModal.types';

const assignAttorneyModalUseCase = (
  store: AssignAttorneyModalStore,
  controls: AssignAttorneyModalControls,
): AssignAttorneyModalUseCase => {
  const uiActions = {
    freezeBackground: () => {
      store.setInitialDocumentBodyStyle(document.body.style.overflow);
      document.body.style.overflow = 'hidden';
    },

    thawBackground: () => {
      document.body.style.overflow = store.initialDocumentBodyStyle;
      store.setInitialDocumentBodyStyle('');
    },

    handleFocus: (event: React.FocusEvent<HTMLElement>) => {
      if (controls.tableContainerRef?.current && event.target instanceof HTMLInputElement) {
        // Get the position of the focused input element
        const inputRect = event.target.getBoundingClientRect();
        const divRect = controls.tableContainerRef.current.getBoundingClientRect();

        // Check if the input element is below the visible area
        if (inputRect.bottom > divRect.bottom + controls.tableContainerRef.current.scrollTop) {
          // Scroll the div to bring the input element into view
          controls.tableContainerRef.current.scrollTop += inputRect.bottom - divRect.bottom + 10;
        } else if (inputRect.top < divRect.top + controls.tableContainerRef.current.scrollTop) {
          // Check if the input element is above the visible area
          // Scroll the div to bring the input element into view
          //tableContainer.current.scrollTop -= divRect.top - inputRect.top;
          controls.tableContainerRef.current.scrollTop -= inputRect.top;
        }
      }
    },

    handleTab: (ev: React.KeyboardEvent, isVisible: boolean, modalId: string) => {
      if (
        ev.key == 'Tab' &&
        !ev.shiftKey &&
        isVisible &&
        (ev.target as Element).classList.contains('usa-modal__close')
      ) {
        const attorneyList = document.querySelector(`#${modalId}-description`);
        if (attorneyList) {
          (attorneyList as HTMLElement).focus();
        }
      }
    },
  };

  const apiActions = {
    fetchAttorneys: async () => {
      let attorneys;
      if (!store.bCase) {
        return;
      }
      try {
        attorneys = await Api2.getOfficeAttorneys(store.bCase.officeCode ?? '');
        store.setAttorneyList((attorneys as ResponseBody<AttorneyUser[]>).data);
      } catch (e) {
        store.setGlobalAlertError((e as Error).message);
      }
    },

    submitValues: async (assignmentChangeCallback: (val: CamsUserReference[]) => void) => {
      if (!store.bCase) {
        throw Error('No bankruptcy case was supplied. Can not set attorneys without a case.');
      }
      let finalAttorneyList: CamsUserReference[] = [];

      controls.modalRef.current?.buttons?.current?.disableSubmitButton(true);

      const ids = store.checkListValues.map((item) => item.id);
      finalAttorneyList = store.attorneyList
        .filter((attorney) => ids.includes(attorney.id))
        .map((attorney) => {
          return getCamsUserReference(attorney);
        });

      // send attorney IDs to API
      store.setIsUpdatingAssignment(true);

      try {
        await Api2.postStaffAssignments({
          caseId: store.bCase?.caseId,
          attorneyList: finalAttorneyList,
          role: CamsRole.TrialAttorney,
        });
        if (store.submissionCallback) {
          store.submissionCallback({
            bCase: store.bCase,
            selectedAttorneyList: finalAttorneyList,
            previouslySelectedList: store.previouslySelectedList,
            status: 'success',
            apiResult: {},
          });
          assignmentChangeCallback(finalAttorneyList);
        }
        store.setCheckListValues([]);
        store.setIsUpdatingAssignment(false);
      } catch (e) {
        if (store.submissionCallback) {
          store.submissionCallback({
            bCase: store.bCase,
            selectedAttorneyList: finalAttorneyList,
            previouslySelectedList: store.previouslySelectedList,
            status: 'error',
            apiResult: e as Error,
          });
        }
        store.setCheckListValues([]);
        store.setIsUpdatingAssignment(false);
      }
      uiActions.thawBackground();
    },
  };

  const checkListActions = {
    attorneyIsInCheckList: (attorney: AttorneyUser): boolean => {
      const result = store.checkListValues.find((theAttorney) => theAttorney.id === attorney.id);
      return result !== undefined;
    },

    updateCheckList: (ev: React.ChangeEvent<HTMLInputElement>, attorney: AttorneyUser) => {
      if (!store.bCase) {
        throw Error('No bankruptcy case was supplied. Can not update checklist without a case.');
      }
      let localCheckListValues = [...store.checkListValues];
      if (ev.target.checked && !checkListActions.attorneyIsInCheckList(attorney)) {
        localCheckListValues.push(attorney);
      } else if (!ev.target.checked && checkListActions.attorneyIsInCheckList(attorney)) {
        localCheckListValues = store.checkListValues.filter(
          (theAttorney) => theAttorney.id !== attorney.id,
        );
      }
      const isTheSame =
        localCheckListValues &&
        !!store.bCase.assignments &&
        deepEqual(localCheckListValues, store.bCase.assignments);

      controls.modalRef.current?.buttons?.current?.disableSubmitButton(isTheSame);

      store.setCheckListValues(localCheckListValues);
    },

    sortAttorneys: (a: AttorneyUser, b: AttorneyUser) => {
      if (a.name < b.name) {
        return -1;
      }
      if (a.name > b.name) {
        return 1;
      }
      return 0;
    },
  };

  const cancelModal = () => {
    store.setCheckListValues([]);
    uiActions.thawBackground();
  };

  const hide = () => {
    if (controls.modalRef.current?.hide) {
      controls.modalRef.current?.hide();
    }
  };

  const onOpen = () => {
    uiActions.freezeBackground();
  };

  const show = (showProps: AssignAttorneyModalOpenProps | undefined) => {
    if (showProps && showProps.bCase) {
      store.setBCase(showProps.bCase);
      if (showProps.bCase.assignments) {
        const attorneys: AttorneyUser[] = [];
        showProps.bCase.assignments.forEach((assignment) => {
          attorneys.push({ id: assignment.userId, name: assignment.name } as AttorneyUser);
        });
        store.setCheckListValues(attorneys);
        store.setPreviouslySelectedList(attorneys);
      }
      if (showProps.callback) {
        store.setSubmissionCallback(() => showProps.callback);
      }
    }
    if (controls.modalRef.current?.show) {
      const showOptions = {
        openModalButtonRef: showProps?.openModalButtonRef ?? undefined,
      };
      controls.modalRef.current?.show(showOptions);
    }
  };

  return {
    ...uiActions,
    ...apiActions,
    ...checkListActions,
    cancelModal,
    hide,
    onOpen,
    show,
  };
};

export default assignAttorneyModalUseCase;
