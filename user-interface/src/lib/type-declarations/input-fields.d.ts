import { ComboOption } from '../components/Combobox';

export interface InputRef {
  setValue: (value: string) => void;
  disable: (value: boolean) => void;
  clearValue: () => void;
  resetValue: () => void;
  getValue: () => string;
  focus: () => void;
}

export type TextAreaRef = InputRef;

export interface ComboBoxRef {
  setSelections: (options: ComboOption[]) => void;
  getSelections: () => ComboOption[];
  clearSelections: () => void;
  disable: (value: boolean) => void;
  focusInput: () => void;
  focus: () => void;
}

export interface RadioRef {
  disable: (value: boolean) => void;
  check: (value: boolean) => void;
  isChecked: () => boolean;
}

export interface DateRange {
  start?: string;
  end?: string;
}

export interface DateRangePickerRef extends Omit<InputRef, 'setValue'> {
  setValue: (options: DateRange) => void;
}

export interface SelectRef extends Omit<InputRef, 'getValue'> {
  getValue: () => SingleSelectOptionList;
}
