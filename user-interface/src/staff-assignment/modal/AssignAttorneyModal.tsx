import './AssignAttorneyModal.scss';
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { getCaseNumber } from '@common/cams/cases';
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

function AssignAttorneyModal_(
  props: AssignAttorneyModalProps,
  ref: React.Ref<AssignAttorneyModalRef>,
) {
  const controls = useAssignAttorneyModalControlsReact();
  const store = useAssignAttorneyModalStoreReact();
  const useCase = assignAttorneyModalUseCase(store, controls);
  const [leadTrialAttorney, setLeadTrialAttorney] = useState<CamsUserReference | null>(null);

  const modalHeading = (
    <>
      Choose Trial Attorney to assign to: {store.bCase?.caseTitle},{' '}
      <span className="case-number">{getCaseNumber(store.bCase?.caseId)}</span>
    </>
  );

  const globalAlert = useGlobalAlert();

  const actionButtonGroup = {
    modalId: props.modalId,
    modalRef: ref as React.RefObject<ModalRefType | null>,
    submitButton: {
      label: 'Assign',
      onClick: () => useCase.submitValues(props.assignmentChangeCallback, leadTrialAttorney!),
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
    setLeadTrialAttorney(store.bCase?.leadTrialAttorney ?? null);
  }, [store.bCase]);

  useEffect(() => {
    if (store.globalAlertError) {
      globalAlert?.error(store.globalAlertError);
    }
  }, [store.globalAlertError]);

  useEffect(() => {
    const checked = store.checkListValues;
    if (checked.length === 1) {
      setLeadTrialAttorney({ id: checked[0].id, name: checked[0].name });
    } else {
      setLeadTrialAttorney((prev) =>
        prev && !checked.find((a) => a.id === prev.id) ? null : prev,
      );
    }
  }, [store.checkListValues]);

  useEffect(() => {
    controls.modalRef.current?.buttons?.current?.disableSubmitButton(leadTrialAttorney === null);
  }, [leadTrialAttorney]);

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
    checkedAttorneys: store.checkListValues,
    leadTrialAttorney,
    updateLeadTrialAttorney: setLeadTrialAttorney,
  };

  return <AssignAttorneyModalView viewModel={viewModel} />;
}

const AssignAttorneyModal = forwardRef(AssignAttorneyModal_);
export default AssignAttorneyModal;

function useAssignAttorneyModalStoreReact() {
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

function useAssignAttorneyModalControlsReact(): AssignAttorneyModalControls {
  const modalRef = useRef<ModalRefType>(null);
  const tableContainerRef = useRef<HTMLTableSectionElement | null>(null);

  return {
    modalRef,
    tableContainerRef,
  };
}
