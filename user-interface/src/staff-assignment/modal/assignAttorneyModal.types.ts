import { AlertDetails } from '@/lib/components/uswds/Alert';
import {
  ModalRefType,
  OpenModalButtonRef,
  SubmitCancelButtonGroupRef,
} from '@/lib/components/uswds/modal/modal-refs';
import { SubmitCancelBtnProps } from '@/lib/components/uswds/modal/SubmitCancelButtonGroup';
import { CaseBasics } from '@common/cams/cases';
import { AttorneyUser, CamsUserReference } from '@common/cams/users';
import { RefObject } from 'react';

export type AssignAttorneyModalCallbackFunction = (props: AssignAttorneyModalCallbackProps) => void;

export interface AssignAttorneyModalCallbackProps {
  apiResult: object;
  bCase: CaseBasics;
  previouslySelectedList: AttorneyUser[];
  selectedAttorneyList: AttorneyUser[];
  status: 'error' | 'success';
}

export interface AssignAttorneyModalControls {
  modalRef: RefObject<ModalRefType>;
  tableContainerRef: RefObject<HTMLDivElement>;
}

export interface AssignAttorneyModalOpenProps {
  bCase: CaseBasics;
  callback: AssignAttorneyModalCallbackFunction;
  openModalButtonRef?: React.Ref<OpenModalButtonRef>;
}

export interface AssignAttorneyModalProps {
  alertMessage?: AlertDetails;
  assignmentChangeCallback: (assignees: CamsUserReference[]) => void;
  modalId: string;
}

export interface AssignAttorneyModalRef {
  buttons?: RefObject<SubmitCancelButtonGroupRef>;
  hide: () => void;
  show: (showProps: AssignAttorneyModalOpenProps | undefined) => void;
}

export interface AssignAttorneyModalStore {
  attorneyList: AttorneyUser[];
  bCase: CaseBasics | null;
  checkListValues: CamsUserReference[];
  globalAlertError: string | undefined;
  initialDocumentBodyStyle: string;
  isUpdatingAssignment: boolean;
  previouslySelectedList: AttorneyUser[];
  setAttorneyList(val: AttorneyUser[]): void;
  setBCase(val: CaseBasics | null): void;
  setCheckListValues(val: CamsUserReference[]): void;
  setGlobalAlertError(val: string | undefined): void;
  setInitialDocumentBodyStyle(val: string): void;
  setIsUpdatingAssignment(val: boolean): void;
  setPreviouslySelectedList(val: AttorneyUser[]): void;
  setSubmissionCallback(val: AssignAttorneyModalCallbackFunction | null): void;
  submissionCallback: AssignAttorneyModalCallbackFunction | null;
}

export interface AssignAttorneyModalUseCase {
  attorneyIsInCheckList(val: AttorneyUser): boolean;
  cancelModal(): void;
  fetchAttorneys(): void;
  handleFocus(event: React.FocusEvent<HTMLElement>): void;
  handleTab(ev: React.KeyboardEvent, isVisible: boolean, modalId: string): void;
  hide(): void;
  onOpen(): void;
  show(showProps: AssignAttorneyModalOpenProps | undefined): void;
  sortAttorneys(a: AttorneyUser, b: AttorneyUser): number;
  submitValues(callback: (val: CamsUserReference[]) => void): void;
  updateCheckList(ev: React.ChangeEvent<HTMLInputElement>, attorney: AttorneyUser): void;
}

export interface AssignAttorneyModalViewModel {
  actionButtonGroup: SubmitCancelBtnProps;
  alertMessage: AlertDetails | undefined;
  attorneyIsInCheckList(val: AttorneyUser): boolean;
  attorneyList: AttorneyUser[];
  cancelModal(): void;
  handleFocus(event: React.FocusEvent<HTMLElement>): void;
  handleTab(ev: React.KeyboardEvent, isVisible: boolean, modalId: string): void;
  isUpdatingAssignment: boolean;
  modalHeading: JSX.Element;
  modalId: string;
  modalRef: RefObject<ModalRefType>;
  onOpen(): void;
  sortAttorneys(a: AttorneyUser, b: AttorneyUser): number;
  tableContainerRef: RefObject<HTMLDivElement>;
  updateCheckList(ev: React.ChangeEvent<HTMLInputElement>, attorney: AttorneyUser): void;
}

export type AssignAttorneyModalViewProps = {
  viewModel: AssignAttorneyModalViewModel;
};
