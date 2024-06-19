import { MultiSelectOptionList } from '../components/CamsSelectMulti';
import { ComboOption } from '../components/Combobox';

export interface InputRef {
  setValue: (value: string) => void;
  disable: (value: boolean) => void;
  clearValue: () => void;
  resetValue: () => void;
  getValue: () => string;
}

export interface ComboBoxRef {
  getValue: () => ComboOption[];
  disable: (value: boolean) => void;
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

export interface SelectMultiRef extends Omit<InputRef, 'getValue' | 'setValue'> {
  getValue: () => MultiSelectOptionList;
  setValue: (records) => void;
}
