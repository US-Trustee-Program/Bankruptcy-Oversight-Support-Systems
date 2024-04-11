/* eslint-disable @typescript-eslint/no-explicit-any */
// refactor - let's find a way to avoid using any
import './SearchableSelect.scss';
import ReactSelect, { SingleValue } from 'react-select';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
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
  required?: boolean;
}

function SearchableSelectComponent(props: SearchableSelectProps, ref: React.Ref<InputRef>) {
  const searchableSelectRef = React.useRef(null);
  const [initialValue, setInitialValue] = React.useState<string | null>(null);

  const [isDisabled, setIsDisabled] = useState<boolean>(false);

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

  useEffect(() => {
    if (initialValue) setValue(initialValue);
  }, []);

  return (
    <div className="usa-form-group uswds-form">
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
        onChange={props.onChange}
        className={`${props.className || ''} cams-searchable-select`}
        styles={customStyles}
        id={props.id}
        data-testid={props.id}
        ref={searchableSelectRef}
        isSearchable={true}
        isDisabled={isDisabled}
        required={props.required ?? false}
      ></ReactSelect>
    </div>
  );
}

const SearchableSelect = forwardRef(SearchableSelectComponent);
export default SearchableSelect;
