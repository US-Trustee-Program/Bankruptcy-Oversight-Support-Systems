import { RefObject } from 'react';

export interface ModalRefType {
  show: () => void;
  hide: () => void;
  buttons?: RefObject<SubmitCancelButtonGroupRef>;
}

export interface SubmitCancelButtonGroupRef {
  disableSubmitButton: (state: boolean) => void;
}

export interface ToggleModalButtonRef {
  disableButton: (state: boolean) => void;
}
