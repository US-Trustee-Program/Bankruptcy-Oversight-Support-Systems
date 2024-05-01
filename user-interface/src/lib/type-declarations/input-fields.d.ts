export interface InputRef {
  setValue: (value: string) => void;
  disable: (value: boolean) => void;
  clearValue: () => void;
  resetValue: () => void;
  getValue: () => string;
}

export interface RadioRef {
  disable: (value: boolean) => void;
  checked: (value: boolean) => void;
}

export interface DateRange {
  start?: string;
  end?: string;
}

export interface DateRangePickerRef extends Omit<InputRef, 'setValue'> {
  setValue: (options: DateRange) => void;
}
