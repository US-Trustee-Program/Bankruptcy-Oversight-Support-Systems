import './forms.scss';
import './Combobox.scss';
import {
  forwardRef,
  PropsWithChildren,
  ReactElement,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { InputRef } from '../../type-declarations/input-fields';
import Icon from './Icon';
import Button, { UswdsButtonStyle } from './Button';
import PillBox from '../PillBox';
import useOutsideClick from '@/lib/hooks/UseOutsideClick';

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
  options: ComboOption[];
  onChange: (options: ComboOption[]) => void;
  multiSelect: boolean;
}

function ComboboxComponent(props: ComboboxProps, ref: React.Ref<InputRef>) {
  const { label, options, value, onChange, multiSelect, ...otherProps } = props;
  const [inputDisabled, setInputDisabled] = useState<boolean>(otherProps.disabled ?? false);
  const [selections, setSelections] = useState<ComboOption[]>();
  const [expandIcon, setExpandIcon] = useState<string>('expand_more');
  const [expanded, setExpanded] = useState<boolean>(false);
  const [expandedClass, setExpandedClass] = useState<string>('closed');
  const [dropdownLocation, setDropdownLocation] = useState<{ bottom: number } | null>(null);
  const [currentSelection, setCurrentSelection] = useState<number>(0);

  const comboboxRef = useRef(null);
  const pillBoxRef = useRef(null);

  useOutsideClick([comboboxRef], isOutsideClick);

  function emitChange(_value: string) {
    // TODO may not need... this came from input component
    /*
    if (onChange) {
      const ev = { target: { value } } as React.ChangeEvent<HTMLInputElement>;
      onChange(ev);
    }
    */
  }

  function getValue() {
    // TODO this should be reimplemented to return the selections list
    return '';
  }

  function resetValue() {
    // TODO this will need to reset the values back to what they were originally...
    //setInputValue(value || '');
  }

  function clearValue() {
    // TODO this should be setup to clear a single value... may not need this.
    //setInputValue('');
    emitChange('');
  }

  function clearAll() {
    setSelections([]);
  }

  function setValue(_value: string) {
    // TODO may not need.  Useful for setting a list of values.  You could instead rely on props.
    //setInputValue(value);
  }

  function disable(value: boolean) {
    setInputDisabled(value);
  }

  function setListItemClass(index: number, option: ComboOption) {
    const classNames = [];
    if (isSelected(option)) classNames.push('selected');
    if (currentSelection === index) classNames.push('highlighted');
    return classNames.join(' ');
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

  function isOutsideClick(ev: MouseEvent) {
    if (comboboxRef.current) {
      const boundingRect = (comboboxRef.current as HTMLDivElement).getBoundingClientRect();
      const containerRight = boundingRect.x + boundingRect.width;
      const containerBottom = boundingRect.y + boundingRect.height;
      const targetX = ev.clientX;
      const targetY = ev.clientY;
      if (
        targetX < boundingRect.x ||
        targetX > containerRight ||
        targetY < boundingRect.y ||
        targetY > containerBottom ||
        selections?.length === 0
      ) {
        closeDropdown();
      }
    }
  }

  function closeDropdown() {
    setExpandIcon('expand_more');
    setExpanded(false);
    setExpandedClass('closed');
    setCurrentSelection(0);
  }

  function toggleDropdown(_ev: React.MouseEvent<HTMLButtonElement>) {
    const screenBottom = window.scrollY + window.innerHeight;
    const inputContainer = document.querySelector(`#${props.id} .input-container`);
    const topYPos = inputContainer?.getBoundingClientRect().top;
    const bottomYPos = inputContainer?.getBoundingClientRect().bottom;

    if (bottomYPos && options.length * 43 > screenBottom - bottomYPos) {
      if (topYPos && bottomYPos) {
        const inputHeight = bottomYPos - topYPos;
        setDropdownLocation({ bottom: inputHeight });
      } else {
        setDropdownLocation(null);
      }
    } else {
      setDropdownLocation(null);
    }

    if (expanded) {
      closeDropdown();
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

  function handleKeyDown(ev: React.KeyboardEvent, index: number) {
    const list = document.querySelector(`#${props.id} .item-list-container ul`);
    const input = document.querySelector(`#${props.id} .input-container input`);

    switch (ev.key) {
      case 'Escape':
        closeDropdown();
        break;
      case 'ArrowDown':
        if (index >= 0 && index < options.length) {
          setCurrentSelection(index + 1);
          if (list) (list.children[index] as HTMLElement).focus({ preventScroll: true });
          ev.stopPropagation();
        } else {
          setCurrentSelection(0);
          if (input) (input as HTMLElement).focus({ preventScroll: true });
          ev.stopPropagation();
        }
        break;
      case 'ArrowUp':
        if (index > 1 && index <= options.length) {
          setCurrentSelection(index - 1);
          if (list) (list.children[index - 2] as HTMLElement).focus({ preventScroll: true });
          ev.stopPropagation();
        } else if (index === 1) {
          setCurrentSelection(0);
          if (input) (input as HTMLElement).focus({ preventScroll: true });
          ev.stopPropagation();
        } else if (index === 0) {
          setCurrentSelection(options.length);
          if (list)
            (list.children[list.children.length - 1] as HTMLElement).focus({ preventScroll: true });
          ev.stopPropagation();
        }
        break;
      case 'Enter':
        // TODO: we need to add code here to select an item in the list
        console.log('Enter is not implemented yet -- see TODO');
        break;
    }
  }

  useEffect(() => {
    //setInputValue(value || '');
  }, [value]);

  useImperativeHandle(ref, () => ({ clearValue, resetValue, setValue, getValue, disable }));

  return (
    <div id={props.id} className="usa-form-group combo-box-form-group" ref={comboboxRef}>
      <div className={`chapter-label ${multiSelect ? 'multi-select' : ''}`}>
        <label className="usa-label" id={props.id + '-label'} htmlFor={props.id}>
          {label}
        </label>
        {multiSelect && selections && selections.length > 0 && (
          <Button uswdsStyle={UswdsButtonStyle.Unstyled} onClick={clearAll}>
            clear
          </Button>
        )}
      </div>
      {multiSelect && (
        <PillBox
          id={`${props.id}-pill-box`}
          selections={selections ?? []}
          onSelectionChange={handlePillSelection}
          ref={pillBoxRef}
        ></PillBox>
      )}
      <div className="usa-combo-box">
        <div className="input-container usa-input">
          <div className="combo-box-input-container">
            <input
              {...otherProps}
              className={`usa-tooltip combo-box-input`}
              onChange={handleInputFilter}
              onKeyDown={(ev) => handleKeyDown(ev, 0)}
              value={value}
              disabled={inputDisabled}
            />
          </div>
          <Button
            className="expand-button"
            uswdsStyle={UswdsButtonStyle.Unstyled}
            onClick={toggleDropdown}
            onKeyDown={(ev) => handleKeyDown(ev, 0)}
            disabled={inputDisabled}
          >
            <Icon name={expandIcon}></Icon>
          </Button>
        </div>
        <div
          className={`item-list-container ${expandedClass}`}
          id={`${props.id}-item-list`}
          aria-hidden={`${expanded}`}
          tabIndex={-1}
          style={dropdownLocation ?? undefined}
        >
          <ul>
            {options.map((option, idx) => (
              <li
                className={setListItemClass(idx, option)}
                key={idx}
                data-value={option.value}
                onClick={() => handleDropdownItemSelection(option)}
                onKeyDown={(ev) => handleKeyDown(ev, idx + 1)}
                tabIndex={expanded ? 0 : -1}
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
