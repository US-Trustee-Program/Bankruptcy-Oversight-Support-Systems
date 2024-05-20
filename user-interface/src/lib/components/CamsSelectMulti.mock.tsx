import React from 'react';
import { forwardRef, useImperativeHandle, useState } from 'react';
import { fireEvent } from '@testing-library/react';
import { SelectMultiRef } from '../type-declarations/input-fields';
import { MultiSelectOptionList } from './CamsSelectMulti';

export interface CamsSelectMultiProps {
  id: string;
  onChange?: (newValue: MultiSelectOptionList) => void;
  className?: string;
  closeMenuOnSelect?: boolean;
  options: MultiSelectOptionList;
  label?: string;
  value?: MultiSelectOptionList;
}

export function MockCamsSelectMultiComponent(
  props: CamsSelectMultiProps,
  ref: React.Ref<SelectMultiRef>,
) {
  const [internalValue, setInternalValue] = React.useState<MultiSelectOptionList>(
    props.value ?? [],
  );
  const [isDisabled, setIsDisabled] = useState<boolean>(false);

  function uniqueSet(baseArray: MultiSelectOptionList) {
    return [...new Set(baseArray)];
  }
  function removeInternalValue(valueRec: Record<string, string>) {
    const newInternalValue = internalValue.filter((element) => {
      element !== valueRec;
    });
    setInternalValue(newInternalValue);
    return newInternalValue;
  }
  function appendInternalValue(valueRec: Record<string, string>) {
    const newInternalValue = uniqueSet([...internalValue, valueRec]);
    setInternalValue(newInternalValue);
    return newInternalValue;
  }

  function handleOnClick(option: Record<string, string>) {
    const newValue = internalValue.includes(option)
      ? removeInternalValue(option)
      : appendInternalValue(option);
    if (props.onChange) props.onChange(newValue);
  }

  function clearValue() {
    setInternalValue([]);
  }

  function resetValue() {
    setValue(props.value ?? []);
  }

  function setValue(value: MultiSelectOptionList) {
    setInternalValue(value);
  }

  function getValue(): MultiSelectOptionList {
    return internalValue;
  }

  function disable(value: boolean) {
    setIsDisabled(value);
  }

  useImperativeHandle(ref, () => {
    return {
      clearValue,
      resetValue,
      getValue,
      setValue,
      disable,
    };
  });

  return (
    <>
      {props.options.map((option: Record<string, string>, idx: number) => {
        return (
          <>
            <button
              id={`${props.id}-${idx}`}
              key={idx}
              onClick={() => handleOnClick(option)}
              data-value={option}
              disabled={isDisabled}
            >
              {internalValue.includes(option) && option.label}
            </button>
          </>
        );
      })}
    </>
  );
}

const CamsSelectMulti = forwardRef(MockCamsSelectMultiComponent);
export default CamsSelectMulti;

export function selectItemInMockSelect(id: string, index: number) {
  const selectButton = document.querySelector(`#${id}-${index}`);
  expect(selectButton).toBeInTheDocument();
  fireEvent.click(selectButton!);
  return selectButton;
}
