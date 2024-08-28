import { RefObject } from 'react';

export interface ModalRefType {
  show: (object) => void;
  hide: (object) => void;
  buttons?: RefObject<SubmitCancelButtonGroupRef>;
}

export interface SubmitCancelButtonGroupRef {
  disableSubmitButton: (state: boolean) => void;
}

export interface OpenModalButtonRef {
  focus: () => void;
  disableButton: (state: boolean) => void;
}
