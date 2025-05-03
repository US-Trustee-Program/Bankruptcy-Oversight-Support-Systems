import { RefObject } from 'react';

export interface ModalRefType {
  buttons?: RefObject<SubmitCancelButtonGroupRef>;
  hide: (object) => void;
  show: (object) => void;
}

export interface OpenModalButtonRef {
  disableButton: (state: boolean) => void;
  focus: () => void;
}

export interface SubmitCancelButtonGroupRef {
  disableSubmitButton: (state: boolean) => void;
}
