import './SearchableSelect.scss';
import { SingleValue } from 'react-select';
import { forwardRef, useEffect, useImperativeHandle } from 'react';
import React from 'react';
import { InputRef } from '../type-declarations/input-fields';

export type SearchableSelectOption = SingleValue<Record<string, string>>;

export interface SearchableSelectProps {
  id: string;
  onChange?: (newValue: SearchableSelectOption) => void;
  className?: string;
  closeMenuOnSelect?: boolean;
  options: Record<string, string>[];
  label?: string;
  value?: string;
}

export function MockSearchableSelectComponent(
  props: SearchableSelectProps,
  ref: React.Ref<InputRef>,
) {
  const searchableSelectRef = React.useRef(null);
  const [initialValue, setInitialValue] = React.useState<string | null>(null);

  useEffect(() => {
    if (props.value !== undefined) {
      setValue(props.value);
    }
    setInitialValue(props.value == undefined ? null : props.value);
  }, [props.value]);

  function clearValue() {
    if (searchableSelectRef.current && Object.hasOwn(searchableSelectRef.current, 'clearValue')) {
      (searchableSelectRef.current as InputRef).clearValue();
    }
  }

  function resetValue() {
    type SelectRef = {
      setValue: (option: Record<string, string>, foo: string) => void;
    };

    if (searchableSelectRef.current && Object.hasOwn(searchableSelectRef.current, 'setValue')) {
      const option = props.options.find((option) => option.value == initialValue);
      if (option) {
        (searchableSelectRef.current as SelectRef).setValue(option, 'select-option');
      }
    }
  }

  function setValue(value: string) {
    type SelectRef = {
      setValue: (option: Record<string, string>, foo: string) => void;
    };

    if (searchableSelectRef.current && Object.hasOwn(searchableSelectRef.current, 'setValue')) {
      const option = props.options.find((option) => option.value == value);
      if (option) {
        (searchableSelectRef.current as SelectRef).setValue(option, 'select-option');
      }
    }
  }

  useImperativeHandle(ref, () => {
    return {
      clearValue,
      resetValue,
      setValue,
    };
  });

  return (
    <>
      {props.options.map((option: SearchableSelectOption, idx: number) => {
        return (
          <button
            id={`test-select-button-${idx}`}
            key={idx}
            onClick={() => {
              props.onChange && props.onChange(option);
            }}
            data-value={option}
          ></button>
        );
      })}
    </>
  );
}

const SearchableSelect = forwardRef(MockSearchableSelectComponent);
export default SearchableSelect;
