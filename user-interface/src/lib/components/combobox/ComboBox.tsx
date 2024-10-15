import '../uswds/forms.scss';
import './ComboBox.scss';
import {
  forwardRef,
  PropsWithChildren,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import Icon from '../uswds/Icon';
import Button, { UswdsButtonStyle } from '../uswds/Button';
import PillBox from '../PillBox';
import useOutsideClick from '@/lib/hooks/UseOutsideClick';
import { ComboBoxRef } from '@/lib/type-declarations/input-fields';
import { Pill } from '../Pill';

export type ComboOption = {
  value: string;
  label: string;
  selected?: boolean;
  hidden?: boolean;
};

export type ComboOptionList = ComboOption | Array<ComboOption>;

type InputProps = JSX.IntrinsicElements['input'] &
  JSX.IntrinsicElements['select'] &
  PropsWithChildren;

export interface ComboBoxProps extends Omit<InputProps, 'onChange' | 'onFocus'> {
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
  multiSelect?: boolean;
  wrapPills?: boolean;
}

function ComboBoxComponent(props: ComboBoxProps, ref: React.Ref<ComboBoxRef>) {
  const {
    label,
    disabled,
    onUpdateSelection,
    onPillSelection,
    onUpdateFilter,
    onClose,
    onDisable,
    onEnable,
    multiSelect,
    wrapPills,
    ariaLabelPrefix,
    ariaDescription,
    value: _value,
    options,
    ...otherProps
  } = props;

  // ========== STATE ==========

  const [comboboxDisabled, setComboboxDisabled] = useState<boolean>(disabled ?? false);
  const [selections, setSelections] = useState<ComboOption[]>(() => {
    if (props.value) {
      const selection = options.find((option) => option.value === props.value);
      if (selection) return [selection];
    }
    return [];
  });

  const [expandIcon, setExpandIcon] = useState<string>('expand_more');
  const [expanded, setExpanded] = useState<boolean>(false);
  const [expandedClass, setExpandedClass] = useState<string>('closed');
  const [dropdownLocation, setDropdownLocation] = useState<{ bottom: number } | null>(null);
  const [filteredOptions, setFilteredOptions] = useState<ComboOption[]>(options);

  // ========== REFS ==========

  const comboBoxRef = useRef(null);
  const pillBoxRef = useRef(null);
  const filterRef = useRef<HTMLInputElement>(null);

  useOutsideClick([comboBoxRef], isOutsideClick);

  // ========== MISC FUNCTIONS ==========

  function clearFilter() {
    if (filterRef.current) filterRef.current.value = '';
    filterDropdown('');
  }

  function closeDropdown(shouldFocusOnInput: boolean = true) {
    setExpandIcon('expand_more');
    setExpanded(false);
    setExpandedClass('closed');
    clearFilter();
    if (shouldFocusOnInput) filterRef.current?.focus();
    if (onClose) onClose(selections);
  }

  function openDropdown() {
    setExpandIcon('expand_less');
    setExpanded(true);
    setExpandedClass('expanded');
  }

  function disable(shouldDisable: boolean) {
    setComboboxDisabled(shouldDisable);
  }

  function elementIsVerticallyScrollable(parent: Element, child: Element) {
    const parentHeight = parent.getBoundingClientRect().height ?? 0;
    const childHeight = child.getBoundingClientRect().height ?? 0;
    return childHeight > parentHeight;
  }

  function filterDropdown(filter: string) {
    const newOptions = [...filteredOptions];
    newOptions?.forEach((option) => {
      if (!filter || option.label.toLowerCase().includes(filter.toLowerCase())) {
        option.hidden = false;
      } else {
        option.hidden = true;
      }
    });
    setFilteredOptions(newOptions);
  }

  function focusAndHandleScroll(ev: React.KeyboardEvent, el: Element) {
    const listContainer = document.querySelector(`#${props.id} .item-list-container`);

    if (listContainer) {
      const list = listContainer.querySelector('ul');
      if (list) {
        (el as HTMLElement).focus({
          preventScroll: !elementIsVerticallyScrollable(listContainer, list),
        });
        ev.preventDefault();
      }
    }
  }

  function getValue() {
    return selections;
  }

  function clearValue() {
    setSelections([]);
  }

  function isOutsideClick(ev: MouseEvent) {
    if (comboBoxRef.current && expanded) {
      const boundingRect = (comboBoxRef.current as HTMLDivElement).getBoundingClientRect();
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
        closeDropdown(false);
      }
    }
  }

  function isSelected(option: ComboOption) {
    let result = false;
    if (selections) {
      for (const item of selections) {
        if (item.value === option.value && item.label === option.label) {
          result = true;
          break;
        }
      }
    }
    return result;
  }

  function getInputClassName(): string {
    let className = 'usa-tooltip combo-box-input';
    if (multiSelect !== true && selections.length) className += ' hide-input';
    return className;
  }

  function setListItemClass(index: number, option: ComboOption) {
    const classNames = [];
    if (option.hidden) {
      classNames.push('hidden');
    } else {
      if (isSelected(option)) classNames.push('selected');
    }
    return classNames.join(' ');
  }

  // ========== HANDLERS ==========

  function handleClearAllClick() {
    setSelections([]);
    clearFilter();
    filterRef.current?.focus();

    if (props.onUpdateSelection) {
      props.onUpdateSelection([]);
    }
  }

  function handleClearAllKeyDown(ev: React.KeyboardEvent) {
    if (ev.key === 'Enter') {
      handleClearAllClick();
    }
  }

  function handleDropdownItemSelection(option: ComboOption) {
    const newSelections: ComboOption[] = [];
    let removed = false;
    if (option.selected === true) option.selected = false;
    else option.selected = true;

    if (multiSelect === true) {
      for (const item of selections) {
        if (item.value === option.value) {
          removed = true;
        } else {
          newSelections.push(item);
        }
      }
    }
    if (!removed) newSelections.push(option);

    setSelections(newSelections);
    if (onUpdateSelection && newSelections) {
      onUpdateSelection(newSelections);
    }

    if (multiSelect !== true) {
      closeDropdown(true);
    }
  }

  function handleInputFilter(ev: React.ChangeEvent<HTMLInputElement>) {
    openDropdown();
    filterDropdown(ev.target.value);
    if (onUpdateFilter) onUpdateFilter(ev.target.value);
  }

  function handleKeyDown(ev: React.KeyboardEvent, index: number, option?: ComboOption) {
    const list = document.querySelector(`#${props.id} .item-list-container ul`);
    const input = filterRef.current;

    switch (ev.key) {
      case 'Tab':
        closeDropdown(false);
        break;
      case 'Escape':
        closeDropdown();
        ev.preventDefault();
        break;
      case 'ArrowDown':
        openDropdown();
        if (list && index < filteredOptions.length) {
          while (
            list.children[index].classList.contains('hidden') &&
            index < filteredOptions.length
          ) {
            ++index;
          }
        }
        if (index >= 0 && index < filteredOptions.length) {
          const button = list?.children[index].querySelector('button');
          if (list && button) focusAndHandleScroll(ev, button);
        } else {
          if (input) focusAndHandleScroll(ev, input);
        }
        break;
      case 'ArrowUp':
        openDropdown();
        if (list && index > 0) {
          while (index > 1 && list.children[index - 2].classList.contains('hidden')) {
            --index;
          }
        }
        if (index > 1 && index <= filteredOptions.length) {
          const button = list?.children[index - 2].querySelector('button');
          if (list && button) focusAndHandleScroll(ev, button);
        } else if (index === 1) {
          if (input) focusAndHandleScroll(ev, input);
        } else if (index === 0) {
          const button = list?.children[list.children.length - 1].querySelector('button');
          if (list && button) focusAndHandleScroll(ev, button);
        }
        break;
      case 'Enter':
        if (!(ev.target as HTMLInputElement).classList.contains('combo-box-input')) {
          handleDropdownItemSelection(option as ComboOption);
          ev.preventDefault();
        }
        break;
    }
  }

  function handleOnInputFocus(ev: React.FocusEvent<HTMLElement>) {
    if (props.onFocus) props.onFocus(ev);
  }

  function handlePillSelection(selections: ComboOption[]) {
    setSelections(selections);
    if (onUpdateSelection && selections) {
      onUpdateSelection(selections);
    }
    if (onPillSelection && selections) {
      onPillSelection(selections);
    }
    filterRef.current?.focus();
  }

  function handleSingleSelectPillClick() {
    handleClearAllClick();
    if (onPillSelection) {
      onPillSelection([]);
    }
    filterRef.current?.focus();
  }

  function handleToggleDropdown(_ev: React.MouseEvent<HTMLButtonElement>) {
    const screenBottom = window.scrollY + window.innerHeight;
    const inputContainer = document.querySelector(`#${props.id} .input-container`);
    const topYPos = inputContainer?.getBoundingClientRect().top;
    const bottomYPos = inputContainer?.getBoundingClientRect().bottom;
    const heightOfAllListItems = filteredOptions.length * 43;

    if (bottomYPos && heightOfAllListItems > screenBottom - bottomYPos) {
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
      openDropdown();
    }
    filterRef.current?.focus();
  }

  // ========== USE EFFECTS ==========

  useEffect(() => {
    setFilteredOptions(options);
  }, [options]);

  useEffect(() => {
    if (props.onUpdateSelection) {
      props.onUpdateSelection(selections);
    }
  }, [selections]);

  useEffect(() => {
    if (comboboxDisabled && onDisable) {
      onDisable();
    } else if (!comboboxDisabled && onEnable) {
      onEnable();
    }
  }, [comboboxDisabled]);

  useImperativeHandle(ref, () => ({ getValue, clearValue, disable }));

  // ========== JSX ==========

  return (
    <div id={props.id} className="usa-form-group combo-box-form-group" ref={comboBoxRef}>
      <div className={`combo-box-label ${multiSelect === true ? 'multi-select' : 'single-select'}`}>
        <label
          className="usa-label"
          id={props.id + '-label'}
          htmlFor={`${props.id}-combo-box-input`}
        >
          {label}
        </label>
        <span id={`${props.id}-aria-description`} hidden>
          {ariaDescription ?? ''}
        </span>
      </div>
      {multiSelect === true && (
        <div className="pills-and-clear-all">
          <PillBox
            id={`${props.id}-pill-box`}
            className="pill-box"
            wrapPills={wrapPills}
            ariaLabelPrefix={ariaLabelPrefix ?? undefined}
            selections={selections ?? []}
            onSelectionChange={handlePillSelection}
            disabled={comboboxDisabled}
            ref={pillBoxRef}
          ></PillBox>
          {selections && selections.length > 0 && (
            <Button
              id={`${props.id}-clear-all-pills-button`}
              className="pill-clear-button"
              uswdsStyle={UswdsButtonStyle.Unstyled}
              onClick={handleClearAllClick}
              onKeyDown={handleClearAllKeyDown}
              aria-label={`clear all selections ${label ? `for ${label}` : ''}`}
              disabled={comboboxDisabled}
            >
              clear
            </Button>
          )}
        </div>
      )}
      <div className="usa-combo-box">
        <div className="input-container usa-input">
          <div className="combo-box-input-container">
            {multiSelect !== true && selections.length > 0 && (
              <Pill
                id={`pill-${props.id}`}
                label={selections[0].label}
                ariaLabelPrefix={ariaLabelPrefix ?? undefined}
                value={selections[0].value}
                wrapText={wrapPills}
                onClick={handleSingleSelectPillClick}
                disabled={comboboxDisabled}
              ></Pill>
            )}
            <input
              {...otherProps}
              id={`${props.id}-combo-box-input`}
              data-testid="combo-box-input"
              className={getInputClassName()}
              onChange={handleInputFilter}
              onKeyDown={(ev) => handleKeyDown(ev, 0)}
              onClick={openDropdown}
              onFocus={handleOnInputFocus}
              disabled={comboboxDisabled}
              aria-label={`${ariaLabelPrefix ? ariaLabelPrefix + ': ' : ''}Enter text to filter options. Use up and down arrows to open dropdown list.`}
              aria-describedby={`${props.id}-aria-description`}
              aria-live={props['aria-live'] ?? undefined}
              aria-haspopup="listbox"
              aria-expanded={expanded}
              aria-controls={`${props.id}-item-list`}
              role="combobox"
              ref={filterRef}
            />
          </div>
          <Button
            id={`${props.id}-expand`}
            className="expand-button"
            uswdsStyle={UswdsButtonStyle.Unstyled}
            onClick={handleToggleDropdown}
            onKeyDown={(ev) => handleKeyDown(ev, 0)}
            disabled={comboboxDisabled}
            tabIndex={-1}
            aria-label="expand dropdown of combo box"
          >
            <Icon name={expandIcon}></Icon>
          </Button>
        </div>
        {!comboboxDisabled && (
          <div
            className={`item-list-container ${expandedClass}`}
            id={`${props.id}-item-list-container`}
            aria-hidden={expanded}
            tabIndex={-1}
            style={dropdownLocation ?? undefined}
          >
            <ul id={`${props.id}-item-list`} role="listbox">
              {filteredOptions.map((option, idx) => (
                <li
                  className={setListItemClass(idx, option)}
                  aria-hidden={option.hidden ? 'true' : 'false'}
                  data-testid={`${props.id}-item-${idx}`}
                  key={`${props.id}-${idx}`}
                >
                  <button
                    className="usa-button--unstyled"
                    data-value={option.value}
                    data-testid={`${props.id}-option-item-${idx}`}
                    onClick={() => handleDropdownItemSelection(option)}
                    onKeyDown={(ev) => handleKeyDown(ev, idx + 1, option)}
                    tabIndex={expanded ? 0 : -1}
                    aria-label={`${multiSelect === true ? 'multi-select' : 'single-select'} option: ${ariaLabelPrefix ?? ''} ${option.label} ${isSelected(option)! ? 'selected' : 'unselected'}`}
                  >
                    {
                      <>
                        {option.label}
                        {isSelected(option) && <Icon name="check"></Icon>}
                      </>
                    }
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

const ComboBox = forwardRef(ComboBoxComponent);
export default ComboBox;
