import './AssignAttorneyModal.scss';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { getCaseNumber } from '@/lib/utils/caseNumber';
import { CaseBasics } from '@common/cams/cases';
import { AttorneyUser, CamsUserReference } from '@common/cams/users';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import assignAttorneyModalUseCase from './assignAttorneyModalUseCase';
import { AssignAttorneyModalView } from './AssignAttorneyModalView';
import {
  AssignAttorneyModalProps,
  AssignAttorneyModalRef,
  AssignAttorneyModalViewModel,
  AssignAttorneyModalCallbackFunction,
  AssignAttorneyModalControls,
} from './assignAttorneyModal.types';

function _AssignAttorneyModal(
  props: AssignAttorneyModalProps,
  ref: React.Ref<AssignAttorneyModalRef>,
) {
  const controls = useAssignAttorneyModalControlsReact();
  const store = useAssignAttorneyModalStoreReact();
  const useCase = assignAttorneyModalUseCase(store, controls);

  const modalHeading = (
    <>
      Choose Trial Attorney to assign to: {store.bCase?.caseTitle},{' '}
      <span className="case-number">{getCaseNumber(store.bCase?.caseId)}</span>
    </>
  );

  const globalAlert = useGlobalAlert();

  const actionButtonGroup = {
    modalId: props.modalId,
    modalRef: ref as React.RefObject<ModalRefType>,
    submitButton: {
      label: 'Assign',
      onClick: () => useCase.submitValues(props.assignmentChangeCallback),
      disabled: true,
      closeOnClick: false,
    },
    cancelButton: {
      label: 'Go back',
    },
  };

  useImperativeHandle(ref, () => {
    return {
      show: useCase.show,
      hide: useCase.hide,
    };
  });

  useEffect(() => {
    useCase.fetchAttorneys();
  }, [store.bCase]);

  useEffect(() => {
    if (store.globalAlertError) {
      globalAlert?.error(store.globalAlertError);
    }
  }, [store.globalAlertError]);

  const viewModel: AssignAttorneyModalViewModel = {
    actionButtonGroup,
    alertMessage: props.alertMessage,
    attorneyIsInCheckList: useCase.attorneyIsInCheckList,
    attorneyList: store.attorneyList,
    cancelModal: useCase.cancelModal,
    handleFocus: useCase.handleFocus,
    handleTab: useCase.handleTab,
    isUpdatingAssignment: store.isUpdatingAssignment,
    modalHeading: modalHeading,
    modalId: props.modalId,
    modalRef: controls.modalRef,
    onOpen: useCase.onOpen,
    sortAttorneys: useCase.sortAttorneys,
    tableContainerRef: controls.tableContainerRef,
    updateCheckList: useCase.updateCheckList,
  };

  return <AssignAttorneyModalView viewModel={viewModel} />;
}

const AssignAttorneyModal = forwardRef(_AssignAttorneyModal);

export default AssignAttorneyModal;

export function useAssignAttorneyModalStoreReact() {
  const [bCase, setBCase] = useState<CaseBasics | null>(null);
  const [initialDocumentBodyStyle, setInitialDocumentBodyStyle] = useState<string>('');
  const [checkListValues, setCheckListValues] = useState<CamsUserReference[]>([]);
  const [previouslySelectedList, setPreviouslySelectedList] = useState<AttorneyUser[]>([]);
  const [isUpdatingAssignment, setIsUpdatingAssignment] = useState<boolean>(false);
  const [attorneyList, setAttorneyList] = useState<AttorneyUser[]>([]);
  const [submissionCallback, setSubmissionCallback] =
    useState<AssignAttorneyModalCallbackFunction | null>(null);
  const [globalAlertError, setGlobalAlertError] = useState<string | undefined>(undefined);

  return {
    bCase,
    setBCase,
    initialDocumentBodyStyle,
    setInitialDocumentBodyStyle,
    checkListValues,
    setCheckListValues,
    previouslySelectedList,
    setPreviouslySelectedList,
    isUpdatingAssignment,
    setIsUpdatingAssignment,
    attorneyList,
    setAttorneyList,
    submissionCallback,
    setSubmissionCallback,
    globalAlertError,
    setGlobalAlertError,
  };
}

export function useAssignAttorneyModalControlsReact(): AssignAttorneyModalControls {
  const modalRef = useRef<ModalRefType>(null);
  const tableContainerRef = useRef<HTMLTableSectionElement | null>(null);

  return {
    modalRef,
    tableContainerRef,
  };
}
