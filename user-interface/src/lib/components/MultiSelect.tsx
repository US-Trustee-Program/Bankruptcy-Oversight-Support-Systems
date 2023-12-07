/* eslint-disable @typescript-eslint/no-explicit-any */
// refactor - let's find a way to avoid using any
import './MultiSelect.scss';
import Select from 'react-select';

export declare type MultiSelectOptionList<Option> = readonly Option[];

export interface MultiSelectProps {
  onChange?: (newValue: MultiSelectOptionList<Record<string, string>>) => void;
  className?: string;
  closeMenuOnSelect?: boolean;
  options?: Record<string, string>[];
  label: string;
}

export default function MultiSelect(props: MultiSelectProps) {
  const customStyles = {
    control: (provided: any, state: { isFocused: any }) => ({
      ...provided,
      background: '#fff',
      borderColor: '#565c65',
      minHeight: '40px',
      boxShadow: state.isFocused ? null : null,
      outline: state.isFocused ? '0.25rem solid #2491ff' : null,
      borderRadius: 0,
      '&:hover': {
        borderColor: '#565c65',
      },
    }),

    placeholder: (provided: any) => ({
      ...provided,
      color: '#565C65',
    }),

    valueContainer: (provided: any) => ({
      ...provided,
      padding: '0 6px',
    }),

    input: (provided: any) => ({
      ...provided,
      margin: '0px',
    }),

    indicatorSeparator: () => ({
      display: 'none',
    }),

    indicatorsContainer: (provided: any) => ({
      ...provided,
      height: '40px',
    }),

    clearIndicator: (provided: any) => ({
      ...provided,
      color: '#1b1b1b',
    }),

    dropdownIndicator: (provided: any) => ({
      ...provided,
      color: '#1b1b1b',
    }),

    multiValueLabel: (provided: any) => ({
      ...provided,
      color: '#1b1b1b',
    }),
  };

  return (
    <Select
      aria-label={props.label}
      options={props.options}
      isMulti
      closeMenuOnSelect={props.closeMenuOnSelect}
      onChange={props.onChange}
      className={`${props.className || ''} cams-multi-select`}
      styles={customStyles}
    ></Select>
  );
}
