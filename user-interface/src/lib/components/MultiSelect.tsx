import ReactSelect from 'react-select';

export declare type MultiSelectOptionList<Option> = readonly Option[];

export interface MultiSelectProps {
  onChange?: (newValue: MultiSelectOptionList<Record<string, string>>) => void;
  className?: string;
  closeMenuOnSelect?: boolean;
  options?: Record<string, string>[];
}

export default function MultiSelect(props: MultiSelectProps) {
  //
  return (
    <ReactSelect
      options={props.options}
      isMulti
      closeMenuOnSelect={props.closeMenuOnSelect}
      onChange={props.onChange}
    ></ReactSelect>
  );
}
