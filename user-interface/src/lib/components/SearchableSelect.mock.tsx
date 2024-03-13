import './SearchableSelect.scss';
import { SingleValue } from 'react-select';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import React from 'react';
import { InputRef } from '../type-declarations/input-fields';
import { fireEvent } from '@testing-library/react';

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

type SelectRef = InputRef & {
  setValue: (option: Record<string, string>, foo: string) => void;
};

export function MockSearchableSelectComponent(
  props: SearchableSelectProps,
  ref: React.Ref<InputRef>,
) {
  const searchableSelectRef = React.useRef<SelectRef>(null);
  const [initialValue, setInitialValue] = React.useState<string | null>(null);
  const [isDisabled, setIsDisabled] = useState<boolean>(false);

  useEffect(() => {
    if (props.value !== undefined) {
      setValue(props.value);
    }
    setInitialValue(props.value == undefined ? null : props.value);
  }, [props.value]);

  function clearValue() {
    if (searchableSelectRef.current && Object.hasOwn(searchableSelectRef.current, 'clearValue')) {
      searchableSelectRef.current.clearValue();
    }
  }

  function resetValue() {
    if (searchableSelectRef.current && Object.hasOwn(searchableSelectRef.current, 'setValue')) {
      const option = props.options.find((option) => option.value == initialValue);
      if (option) {
        searchableSelectRef.current.setValue(option, 'select-option');
      }
    }
  }

  function setValue(value: string) {
    if (searchableSelectRef.current && Object.hasOwn(searchableSelectRef.current, 'setValue')) {
      const option = props.options.find((option) => option.value == value);
      if (option) {
        searchableSelectRef.current.setValue(option, 'select-option');
      }
    }
  }

  function disable(value: boolean) {
    setIsDisabled(value);
  }

  useImperativeHandle(ref, () => {
    return {
      clearValue,
      resetValue,
      setValue,
      disable,
    };
  });

  return (
    <>
      {props.options.map((option: SearchableSelectOption, idx: number) => {
        return (
          <button
            id={`${props.id}-${idx}`}
            key={idx}
            onClick={() => {
              props.onChange && props.onChange(option);
            }}
            data-value={option}
            disabled={isDisabled}
          ></button>
        );
      })}
    </>
  );
}

const SearchableSelect = forwardRef(MockSearchableSelectComponent);
export default SearchableSelect;

export function selectItemInMockSelect(id: string, index: number) {
  const selectButton = document.querySelector(`#${id}-${index}`);
  expect(selectButton).toBeInTheDocument();
  fireEvent.click(selectButton!);
  return selectButton;
}
