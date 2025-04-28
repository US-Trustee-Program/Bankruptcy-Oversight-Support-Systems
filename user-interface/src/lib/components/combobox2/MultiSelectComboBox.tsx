import '../uswds/forms.scss';
import './ComboBox.scss';
import React, {forwardRef, PropsWithChildren, useImperativeHandle, useState,} from 'react';
import {ComboBoxRef} from '@/lib/type-declarations/input-fields';

export type ComboOption = {
  value: string;
  label: string;
  divider?: boolean;
};

type StateNames = 'DISABLED' | 'ENABLED'

type Event = {
  _name: 'ENABLE' | 'DISABLE' | 'CLEAR_SELECTED';
} | {
  _name: 'SET_SELECTED';
  selected: string[];
} | {
  _name: 'SET_OPTIONS';
  options: ComboOption[];
} | {
  _name: 'SELECT_OPTION';
  option: ComboOption;
}

type State = {
  _name: StateNames;
  disabled: boolean;
  options: ComboOption[];
  selected: string[];
}

const disable = (state: State): State => {
  return {
    ...state,
    disabled: true,
    _name: 'DISABLED',
  }
}

const enable = (state: State): State => {
  return {
    ...state,
    disabled: false,
    _name: 'ENABLED',
  }
}

const clearSelectedOptions = (state: State): State => {
  return {
    ...state,
    selected: [],
  }
}

// This really supports the single select use case. Multi select can just use setOptions.
const selectOption = (state: State, option: ComboOption): State => {
  const selected = state.selected.includes(option.value) ? state.selected.filter((item) => item !== option.value) : [...state.selected, option.value]
  return {
    ...state,
    selected,
  }
}

const setOptions = (state: State, options: ComboOption[]): State => {
  return {
    ...state,
    options,
    selected: [],
  }
}

const setSelected = (state: State, selected: string[]): State => {
  return {
    ...state,
    selected,
  }
}

function transition(state: State, event: Event): State {
  switch (state._name) {
    case 'DISABLED':
      switch (event._name) {
        case 'ENABLE':
          return enable(state);
        case "SET_OPTIONS":
          return setOptions(state, event.options);
        case "SET_SELECTED":
          return setSelected(state, event.selected);
        case "CLEAR_SELECTED":
          return clearSelectedOptions(state);
        default:
          return state;
      }

    case 'ENABLED':
      switch (event._name) {
        case 'DISABLE':
          return disable(state);
        case "SET_OPTIONS":
          return setOptions(state, event.options);
        case "SET_SELECTED":
          return setSelected(state, event.selected);
        case "CLEAR_SELECTED":
          return clearSelectedOptions(state);
        case "SELECT_OPTION":
          return selectOption(state, event.option);
        default:
          return state;
      }
  }
}

export type {
  State,
  Event
}

export const StateMachine = {
  transition
}

type InputProps = JSX.IntrinsicElements['input'] &
  JSX.IntrinsicElements['select'] &
  PropsWithChildren;

export interface ComboBoxProps extends Omit<InputProps, 'onChange' | 'onFocus'> {
  id: string;
  label?: string;
  ariaLabelPrefix?: string;
  ariaDescription?: string;
  autoComplete?: 'off';
  icon?: string;
  options: ComboOption[];
  onUpdateSelection?: (options: ComboOption[]) => void;
  onPillSelection?: (options: ComboOption[]) => void;
  onUpdateFilter?: (value: string) => void;
  onClose?: (options: ComboOption[]) => void;
  onDisable?: () => void;
  onEnable?: () => void;
  onFocus?: (ev: React.FocusEvent<HTMLElement>) => void;
  wrapPills?: boolean;
}

function _MultiSelectComboBox(props: ComboBoxProps, ref: React.Ref<ComboBoxRef>) {

  const [state, setState] = useState<State>({
    _name: props.disabled ? 'DISABLED' : 'ENABLED',
    disabled: !!props.disabled,
    options: props.options,
    selected: [] // props.value ?? [],
  });

  const handleSelectedOption = (option: ComboOption) => {
    setState(transition(state, {_name: 'SELECT_OPTION', option}))
  }

  useImperativeHandle(ref, () => ({
    setValue: (selected: string[]) => transition(state, {_name: "SET_SELECTED", selected}),
    getValue: () => state.selected,
    clearValue: () => transition(state, {_name: "CLEAR_SELECTED"}),
    disable: () => transition(state, {_name: "DISABLE"}),
    focusInput: () => {},
    focusSingleSelectionPill: () => {},
  }));

  return <></>;
}

const MultiSelectComboBox = forwardRef(_MultiSelectComboBox);
export default MultiSelectComboBox;
