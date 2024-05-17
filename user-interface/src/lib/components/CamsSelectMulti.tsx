/* eslint-disable @typescript-eslint/no-explicit-any */
// refactor - let's find a way to avoid using any
import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import ReactSelect, { MultiValue } from 'react-select';
import { InputRef, SelectMultiRef } from '../type-declarations/input-fields';
import './CamsSelect.scss';

export type MultiSelectOptionList = MultiValue<Record<string, string>>;

export interface CamsSelectMultiProps {
  id: string;
  className?: string;
  closeMenuOnSelect?: boolean;
  options: Record<string, string>[];
  label?: string;
  value?: string;
  required?: boolean;
  isSearchable?: boolean;
  onChange?: (newValue: MultiSelectOptionList) => void;
}

function _CamsSelectMulti(
  props: CamsSelectMultiProps,
  CamsSelectMultiRef: React.Ref<SelectMultiRef>,
) {
  const camsSelectRef = React.useRef(null);
  const [initialValue, setInitialValue] = React.useState<string | null>(null);
  const [internalValue, setInternalValue] = useState<MultiSelectOptionList>([]);

  const [isDisabled, setIsDisabled] = useState<boolean>(false);

  let classes = 'cams-select';
  if (props.className) classes += ` ${props.className}`;

  useEffect(() => {
    if (props.required !== undefined && props.required === true) {
      const inputEl = document.querySelector(`#${props.id} input`);
      if (inputEl) {
        inputEl.setAttribute('required', 'true');
      }
    }
  }, []);

  useEffect(() => {
    if (props.value !== undefined) {
      setValue(props.value);
    }
    setInitialValue(props.value == undefined ? null : props.value);
  }, [props.value]);

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

  function clearValue() {
    if (camsSelectRef.current && Object.hasOwn(camsSelectRef.current, 'clearValue')) {
      (camsSelectRef.current as InputRef).clearValue();
    }
  }

  function resetValue() {
    type SelectRef = {
      setValue: (option: Record<string, string>, foo: string) => void;
    };

    if (camsSelectRef.current && Object.hasOwn(camsSelectRef.current, 'setValue')) {
      const option = props.options.find((option) => option.value == initialValue);
      if (option) {
        (camsSelectRef.current as SelectRef).setValue(option, 'select-option');
      }
    }
  }

  function setValue(value: string) {
    type SelectRef = {
      setValue: (option: Record<string, string>, foo: string) => void;
    };

    if (camsSelectRef.current && Object.hasOwn(camsSelectRef.current, 'setValue')) {
      const option = props.options.find((option) => option.value == value);
      if (option) {
        (camsSelectRef.current as SelectRef).setValue(option, 'select-option');
      }
    }
  }

  function getValue(): MultiSelectOptionList {
    return internalValue;
  }

  function handleOnChange(ev: MultiSelectOptionList) {
    setInternalValue(ev);
    if (props.onChange) props.onChange(ev);
  }

  function disable(value: boolean) {
    setIsDisabled(value);
    const inputEl = document.querySelector(`#${props.id} input`);
    if (inputEl) {
      inputEl.setAttribute('disabled', value.toString());
    }
  }

  useImperativeHandle(CamsSelectMultiRef, () => {
    return {
      setValue,
      disable,
      clearValue,
      resetValue,
      getValue,
    };
  });

  useEffect(() => {
    if (initialValue) setValue(initialValue);
  }, []);

  return (
    <div className="usa-form-group">
      <label
        className="usa-label"
        id={props.id + '-label'}
        htmlFor={props.id}
        data-required={props.required ? 'true' : null}
      >
        {props.label}
      </label>
      <ReactSelect
        aria-label={props.label}
        options={props.options}
        closeMenuOnSelect={props.closeMenuOnSelect}
        onChange={handleOnChange}
        className={classes}
        styles={customStyles}
        id={props.id}
        data-testid={props.id}
        ref={camsSelectRef}
        isSearchable={props.isSearchable}
        isMulti={true}
        isDisabled={isDisabled}
        required={props.required}
      ></ReactSelect>
    </div>
  );
}

const CamsSelectMulti = forwardRef(_CamsSelectMulti);
export default CamsSelectMulti;
