import { AlertDetails } from '@/lib/components/uswds/Alert';
import {
  ModalRefType,
  OpenModalButtonRef,
  SubmitCancelButtonGroupRef,
} from '@/lib/components/uswds/modal/modal-refs';
import { SubmitCancelBtnProps } from '@/lib/components/uswds/modal/SubmitCancelButtonGroup';
import { CaseBasics } from '@common/cams/cases';
import { AttorneyUser, CamsUserReference } from '@common/cams/users';
import { RefObject, type JSX } from 'react';

export interface AssignAttorneyModalStore {
  bCase: CaseBasics | null;
  setBCase(val: CaseBasics | null): void;
  initialDocumentBodyStyle: string;
  setInitialDocumentBodyStyle(val: string): void;
  checkListValues: CamsUserReference[];
  setCheckListValues(val: CamsUserReference[]): void;
  previouslySelectedList: AttorneyUser[];
  setPreviouslySelectedList(val: AttorneyUser[]): void;
  isUpdatingAssignment: boolean;
  setIsUpdatingAssignment(val: boolean): void;
  attorneyList: AttorneyUser[];
  setAttorneyList(val: AttorneyUser[]): void;
  submissionCallback: AssignAttorneyModalCallbackFunction | null;
  setSubmissionCallback(val: AssignAttorneyModalCallbackFunction | null): void;
  globalAlertError: string | undefined;
  setGlobalAlertError(val: string | undefined): void;
}

export interface AssignAttorneyModalControls {
  modalRef: RefObject<ModalRefType | null>;
  tableContainerRef: RefObject<HTMLDivElement | null>;
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
  modalRef: RefObject<ModalRefType | null>;
  onOpen(): void;
  sortAttorneys(a: AttorneyUser, b: AttorneyUser): number;
  tableContainerRef: RefObject<HTMLDivElement | null>;
  updateCheckList(ev: React.ChangeEvent<HTMLInputElement>, attorney: AttorneyUser): void;
}

export interface AssignAttorneyModalUseCase {
  attorneyIsInCheckList(val: AttorneyUser): boolean;
  cancelModal(): void;
  fetchAttorneys(officeCode?: string): void;
  handleFocus(event: React.FocusEvent<HTMLElement>): void;
  handleTab(ev: React.KeyboardEvent, isVisible: boolean, modalId: string): void;
  hide(): void;
  onOpen(): void;
  show(showProps: AssignAttorneyModalOpenProps | undefined): void;
  sortAttorneys(a: AttorneyUser, b: AttorneyUser): number;
  submitValues(callback: (val: CamsUserReference[]) => void): void;
  updateCheckList(ev: React.ChangeEvent<HTMLInputElement>, attorney: AttorneyUser): void;
}

export interface AssignAttorneyModalCallbackProps {
  bCase: CaseBasics;
  selectedAttorneyList: AttorneyUser[];
  previouslySelectedList: AttorneyUser[];
  status: 'success' | 'error';
  apiResult: object;
}

export type AssignAttorneyModalCallbackFunction = (props: AssignAttorneyModalCallbackProps) => void;

export interface AssignAttorneyModalOpenProps {
  bCase: CaseBasics;
  callback: AssignAttorneyModalCallbackFunction;
  openModalButtonRef?: React.Ref<OpenModalButtonRef>;
}

export interface AssignAttorneyModalRef {
  show: (showProps: AssignAttorneyModalOpenProps | undefined) => void;
  hide: () => void;
  buttons?: RefObject<SubmitCancelButtonGroupRef | null>;
}

export interface AssignAttorneyModalProps {
  modalId: string;
  alertMessage?: AlertDetails;
  assignmentChangeCallback: (assignees: CamsUserReference[]) => void;
}

export type AssignAttorneyModalViewProps = {
  viewModel: AssignAttorneyModalViewModel;
};
