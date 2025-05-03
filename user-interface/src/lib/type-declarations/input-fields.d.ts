import { ComboOption } from '../components/Combobox';

export interface ComboBoxRef {
  clearSelections: () => void;
  disable: (value: boolean) => void;
  focusInput: () => void;
  getSelections: () => ComboOption[];
  setSelections: (options: ComboOption[]) => void;
}

export interface DateRange {
  end?: string;
  start?: string;
}

export interface DateRangePickerRef extends Omit<InputRef, 'setValue'> {
  setValue: (options: DateRange) => void;
}

export interface InputRef {
  clearValue: () => void;
  disable: (value: boolean) => void;
  focus: () => void;
  getValue: () => string;
  resetValue: () => void;
  setValue: (value: string) => void;
}

export interface RadioRef {
  check: (value: boolean) => void;
  disable: (value: boolean) => void;
  isChecked: () => boolean;
}

export interface SelectRef extends Omit<InputRef, 'getValue'> {
  getValue: () => SingleSelectOptionList;
}

export type TextAreaRef = InputRef;
