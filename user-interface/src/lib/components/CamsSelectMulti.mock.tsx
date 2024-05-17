import './CamsSelectMulti.scss';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import React from 'react';
import { SelectRef } from '../type-declarations/input-fields';
import { fireEvent } from '@testing-library/react';
import { MultiSelectOptionList } from './CamsSelectMulti';

export interface CamsSelectMultiProps {
  id: string;
  onChange?: (newValue: MultiSelectOptionList) => void;
  className?: string;
  closeMenuOnSelect?: boolean;
  options: Record<string, string>[];
  label?: string;
  value?: string;
}

export function MockCamsSelectMultiComponent(
  props: CamsSelectMultiProps,
  ref: React.Ref<SelectRef>,
) {
  const [internalValue, setInternalValue] = React.useState<MultiSelectOptionList>([]);
  const [isDisabled, setIsDisabled] = useState<boolean>(false);

  function uniqueSet(baseArray: MultiSelectOptionList) {
    return [...new Set(baseArray)];
  }

  function appendInternalValue(valueRec: Record<string, string>) {
    setInternalValue(uniqueSet([...internalValue, valueRec]));
  }

  useEffect(() => {
    if (props.value !== undefined) {
      const valueRec = props.options.find((rec) => rec.value === props.value);
      if (valueRec) {
        appendInternalValue(valueRec);
      }
    }
  }, [props.value]);

  function handleOnClick(option: Record<string, string>) {
    appendInternalValue(option);
    if (props.onChange) props.onChange && props.onChange(uniqueSet([...internalValue, option]));
  }

  function clearValue() {
    setInternalValue([]);
  }

  function resetValue() {
    if (props.value) setValue(props.value);
    else setInternalValue([]);
  }

  function setValue(value: string) {
    const valueRec = props.options.find((rec) => rec.value === value);
    if (valueRec) appendInternalValue(valueRec);
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
          <button
            id={`${props.id}-${idx}`}
            key={idx}
            onClick={() => handleOnClick(option)}
            data-value={option}
            disabled={isDisabled}
          ></button>
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
