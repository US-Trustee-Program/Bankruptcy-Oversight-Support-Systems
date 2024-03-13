export interface InputRef {
  clearValue: () => void;
  resetValue: () => void;
  setValue: (value: string) => void;
  disable: (value: boolean) => void;
}
