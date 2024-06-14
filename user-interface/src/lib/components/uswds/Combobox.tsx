import './forms.scss';
import './Combobox.scss';
import {
  forwardRef,
  PropsWithChildren,
  ReactElement,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';
import { InputRef } from '../../type-declarations/input-fields';
import Icon from './Icon';
import Button, { UswdsButtonStyle } from './Button';
import ComboboxMultiSelectInput from './ComboboxMultiSelectInput';

// Alias for readability.
//const debounce = setTimeout;

export type ComboOption = {
  value: string;
  label: string;
  selected?: boolean;
};

type InputProps = JSX.IntrinsicElements['input'] &
  JSX.IntrinsicElements['select'] &
  PropsWithChildren;

interface ComboboxProps extends PropsWithChildren, Omit<InputProps, 'onChange'> {
  children?: ReactElement | Array<ReactElement>;
  label?: string;
  autoComplete?: 'off';
  position?: 'left' | 'right';
  value?: string;
  icon?: string;
  includeClearButton?: boolean;
  options: ComboOption[];
  onChange: (options: ComboOption[]) => void;
  multiSelect: boolean;
}

function ComboboxComponent(props: ComboboxProps, ref: React.Ref<InputRef>) {
  const { label, includeClearButton, options, value, onChange, multiSelect, ...otherProps } = props;
  const [inputDisabled, setInputDisabled] = useState<boolean>(otherProps.disabled ?? false);
  const [selections, setSelections] = useState<ComboOption[]>();
  const [expandIcon, setExpandIcon] = useState<string>('expand_more');
  const [expanded, setExpanded] = useState<boolean>(false);
  const [expandedClass, setExpandedClass] = useState<string>('closed');

  function emitChange(_value: string) {
    /*
    if (onChange) {
      const ev = { target: { value } } as React.ChangeEvent<HTMLInputElement>;
      onChange(ev);
    }
    */
  }

  function getValue() {
    return '';
  }

  function resetValue() {
    //setInputValue(value || '');
  }

  function clearValue() {
    //setInputValue('');
    emitChange('');
  }

  function setValue(_value: string) {
    //setInputValue(value);
  }

  function disable(value: boolean) {
    setInputDisabled(value);
  }

  function isSelected(option: ComboOption) {
    let result = false;
    if (selections) {
      for (const item of selections) {
        if (item.value === option.value) {
          result = true;
          break;
        }
      }
    }
    return result;
  }

  function handleDropdownItemSelection(option: ComboOption) {
    let newSelections: ComboOption[] = [];
    let removed = false;
    if (option.selected === true) option.selected = false;
    else option.selected = true;

    if (selections) {
      for (const item of selections) {
        if (item.value === option.value) {
          removed = true;
        } else {
          newSelections.push(item);
        }
      }
      if (!removed) newSelections.push(option);
    } else {
      newSelections = [option];
    }

    setSelections(newSelections);
    if (onChange && newSelections) {
      onChange(newSelections);
    }
  }

  function toggleDropdown() {
    if (expanded) {
      setExpandIcon('expand_more');
      setExpanded(false);
      setExpandedClass('closed');
    } else {
      setExpandIcon('expand_less');
      setExpanded(true);
      setExpandedClass('expanded');
    }
  }

  function handlePillSelection(selections: ComboOption[]) {
    setSelections(selections);
  }

  function handleInputFilter(ev: React.ChangeEvent<HTMLInputElement>) {
    console.log(ev);
  }

  useEffect(() => {
    //setInputValue(value || '');
  }, [value]);

  useImperativeHandle(ref, () => ({ clearValue, resetValue, setValue, getValue, disable }));

  return (
    <div className="usa-form-group">
      <label className="usa-label" id={props.id + '-label'} htmlFor={props.id}>
        {label}
      </label>
      <div className="usa-combo-box">
        {includeClearButton && !inputDisabled && (
          <div className="usa-input-suffix" aria-hidden="true">
            <Button uswdsStyle={UswdsButtonStyle.Unstyled} onClick={clearValue}>
              <Icon name="close"></Icon>
            </Button>
          </div>
        )}
        <div className="input-container usa-input">
          {multiSelect && (
            <ComboboxMultiSelectInput
              selections={selections}
              onSelectionChange={handlePillSelection}
              onChange={handleInputFilter}
            ></ComboboxMultiSelectInput>
          )}
          <Button
            className="expand-button"
            uswdsStyle={UswdsButtonStyle.Unstyled}
            onClick={toggleDropdown}
          >
            <Icon name={expandIcon}></Icon>
          </Button>
        </div>
        <div
          className={`item-list-container ${expandedClass}`}
          id={`${props.id}-item-list`}
          aria-hidden={`${expanded}`}
          tabIndex={-1}
        >
          <ul>
            {options.map((option, idx) => (
              <li
                className={isSelected(option) ? 'selected' : ''}
                key={idx}
                data-value={option.value}
                onClick={() => handleDropdownItemSelection(option)}
              >
                {option.label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

const Combobox = forwardRef(ComboboxComponent);
export default Combobox;
