import { RefObject } from 'react';

export interface ModalRefType {
  show: (object) => void;
  hide: () => void;
  buttons?: RefObject<SubmitCancelButtonGroupRef | null>;
}

export interface SubmitCancelButtonGroupRef {
  disableSubmitButton: (state: boolean) => void;
}

export interface OpenModalButtonRef {
  focus: () => void;
  disableButton: (state: boolean) => void;
}
