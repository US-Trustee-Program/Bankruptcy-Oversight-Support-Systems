/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import ReactSelect, { GroupBase, MultiValue, SelectInstance } from 'react-select';
import { SelectMultiRef } from '../type-declarations/input-fields';
import './CamsSelect.scss';

type ReactSelectRef = SelectInstance<
  Record<string, string>,
  true,
  GroupBase<Record<string, string>>
>;

export type MultiSelectOptionList = MultiValue<Record<string, string>>;

export interface CamsSelectMultiProps {
  id: string;
  className?: string;
  closeMenuOnSelect?: boolean;
  options: MultiSelectOptionList;
  label?: string;
  value?: MultiSelectOptionList;
  required?: boolean;
  isSearchable?: boolean;
  disabled?: boolean;
  onChange?: (newValue: MultiSelectOptionList) => void;
}

function _CamsSelectMulti(
  props: CamsSelectMultiProps,
  CamsSelectMultiRef: React.Ref<SelectMultiRef>,
) {
  const camsSelectRef = React.useRef<ReactSelectRef>(null);
  const [internalValue, setInternalValue] = useState<MultiSelectOptionList>(props.value ?? []);

  const [isDisabled, setIsDisabled] = useState<boolean>(!!props.disabled);

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

    menuPortal: (provided: any) => ({
      ...provided,
      zIndex: 1000,
    }),

    menu: (provided: any) => ({
      ...provided,
      zIndex: 1000,
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
    if (camsSelectRef.current) camsSelectRef.current.clearValue();
  }

  function resetValue() {
    setValue(props.value ?? []);
  }

  function setValue(value: MultiSelectOptionList) {
    if (camsSelectRef.current) camsSelectRef.current.setValue(value, 'select-option');
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
      value === true
        ? inputEl.setAttribute('disabled', 'true')
        : inputEl.removeAttribute('disabled');
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
        value={internalValue}
        menuPortalTarget={document.body}
        menuPosition="fixed"
      ></ReactSelect>
    </div>
  );
}

const CamsSelectMulti = forwardRef(_CamsSelectMulti);
export default CamsSelectMulti;
