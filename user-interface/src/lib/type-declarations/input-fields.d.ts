export interface InputRef {
  clearValue: () => void;
  resetValue: () => void;
  setValue: (value: string) => void;
  disable: (value: boolean) => void;
}

export interface RadioRef {
  disable: (value: boolean) => void;
  checked: (value: boolean) => void;
}
