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
  multiSelect?: boolean;
  wrapPills?: boolean;
}

function ComboBoxComponent(props: ComboBoxProps, ref: React.Ref<ComboBoxRef>) {
  const {
    id: comboBoxId,
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

  const [comboboxDisabled, setComboboxDisabled] = useState<boolean>(
    disabled !== undefined ? !!disabled : false,
  );
  const [selections, setSelections] = useState<ComboOption[]>(() => {
    if (props.value) {
      const selection = options.find((option) => option.value === props.value);
      if (selection) {
        selection.selected = true;
        return [selection];
      }
    }
    return [];
  });

  const [expandIcon, setExpandIcon] = useState<string>('expand_more');
  const [expanded, setExpanded] = useState<boolean>(false);
  const [expandedClass, setExpandedClass] = useState<string>('closed');
  const [dropdownLocation, setDropdownLocation] = useState<{ bottom: number } | null>(null);
  const [filteredOptions, setFilteredOptions] = useState<ComboOption[]>(options);
  const [currentListItem, setCurrentListItem] = useState<string | undefined>(undefined);

  // ========== REFS ==========

  const comboBoxRef = useRef(null);
  const pillBoxRef = useRef(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const singleSelectionPillRef = useRef<HTMLButtonElement>(null);

  useOutsideClick([comboBoxRef], isOutsideClick);

  // ========== MISC FUNCTIONS ==========

  function clearFilter() {
    if (filterRef.current) {
      filterRef.current.value = '';
    }
    filterDropdown('');
  }

  function closeDropdown(shouldFocusOnInput: boolean = true) {
    setExpandIcon('expand_more');
    setExpanded(false);
    setExpandedClass('closed');
    clearFilter();
    if (shouldFocusOnInput) {
      if (!multiSelect && selections.length > 0) {
        singleSelectionPillRef.current?.focus();
      } else {
        filterRef.current?.focus();
      }
    }
    if (onClose) {
      onClose(selections);
    }
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
    const listContainer = document.querySelector(`#${comboBoxId} .item-list-container`);

    if (listContainer) {
      const list = listContainer.querySelector('ul');
      if (list) {
        (el as HTMLElement).focus({
          preventScroll: !elementIsVerticallyScrollable(listContainer, list),
        });
        ev.preventDefault();
        ev.stopPropagation();
      }
    }
  }

  function setValue(values: ComboOption[]) {
    setSelections(values);
  }

  function getValue() {
    return selections;
  }

  function clearValue() {
    setSelections([]);
  }

  const focusInput = () => {
    filterRef.current?.focus();
  };

  const focusSingleSelectionPill = () => {
    if (!multiSelect) {
      if (selections.length > 0) {
        singleSelectionPillRef.current?.focus();
      } else {
        focusInput();
      }
    }
  };

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
    if (multiSelect !== true && selections.length) {
      className += ' hide-input';
    }
    return className;
  }

  function setListItemClass(_index: number, option: ComboOption) {
    const classNames = [];
    if (option.hidden) {
      classNames.push('hidden');
    } else if (isSelected(option)) {
      classNames.push('selected');
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

  function handleDropdownItemSelection(option: ComboOption, isSelected: boolean) {
    const newSelections: ComboOption[] = [];
    let removed = false;
    if (isSelected === true || option.selected === true) {
      option.selected = false;
      removed = true;
    } else {
      option.selected = true;
    }

    if (multiSelect === true) {
      for (const item of selections) {
        if (item.value === option.value) {
          removed = true;
        } else {
          newSelections.push(item);
        }
      }
    }
    if (!removed) {
      newSelections.push(option);
    }

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
    if (onUpdateFilter) {
      onUpdateFilter(ev.target.value);
    }
  }

  function handleKeyDown(
    ev: React.KeyboardEvent,
    index: number,
    option?: ComboOption,
    isSelected?: boolean,
  ) {
    const list = document.querySelector(`#${comboBoxId} .item-list-container ul`);
    const input = filterRef.current;

    switch (ev.key) {
      case 'Tab':
        closeDropdown(false);
        setCurrentListItem(undefined);
        break;
      case 'Escape':
        closeDropdown();
        setCurrentListItem(undefined);
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
          const li = list?.children[index];
          if (list && li) {
            focusAndHandleScroll(ev, li);
            setCurrentListItem(li?.id);
          }
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
          const li = list?.children[index - 2];
          if (list && li) {
            focusAndHandleScroll(ev, li);
            setCurrentListItem(li?.id);
          }
        } else if (index === 1) {
          let element;
          if (selections.length && !multiSelect) {
            element = singleSelectionPillRef.current;
          } else if (input) {
            element = input;
          }
          if (element) {
            focusAndHandleScroll(ev, element);
            setCurrentListItem(undefined);
          }
          closeDropdown(true);
        }
        break;
      case 'Enter':
        if (!(ev.target as HTMLInputElement).classList.contains('combo-box-input')) {
          handleDropdownItemSelection(option as ComboOption, isSelected ?? false);
          setCurrentListItem(undefined);
          ev.preventDefault();
        }
        break;
    }
  }

  function handleOnInputFocus(ev: React.FocusEvent<HTMLElement>) {
    if (props.onFocus) {
      props.onFocus(ev);
    }
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
    const inputContainer = document.querySelector(`#${comboBoxId} .input-container`);
    const topYPos = inputContainer?.getBoundingClientRect().top;
    const bottomYPos = inputContainer?.getBoundingClientRect().bottom;
    const windowMiddle = window.innerHeight / 2;
    if (topYPos && topYPos > windowMiddle) {
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

  useImperativeHandle(ref, () => ({
    setValue,
    getValue,
    clearValue,
    disable,
    focusInput,
    focusSingleSelectionPill,
  }));

  // ========== JSX ==========

  return (
    <div id={comboBoxId} className="usa-form-group combo-box-form-group" ref={comboBoxRef}>
      <div className={`combo-box-label ${multiSelect === true ? 'multi-select' : 'single-select'}`}>
        <label
          className="usa-label"
          id={comboBoxId + '-label'}
          htmlFor={`${comboBoxId}-combo-box-input`}
        >
          {label} {props.required && <span className="required-form-field">*</span>}
        </label>
        <span id={`${comboBoxId}-aria-description`} hidden>
          {ariaDescription ?? ''}
        </span>
      </div>
      {multiSelect === true && (
        <div className="pills-and-clear-all">
          <PillBox
            id={`${comboBoxId}-pill-box`}
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
              id={`${comboBoxId}-clear-all-pills-button`}
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
        <div
          className={`input-container usa-input ${comboboxDisabled ? 'disabled' : ''}`}
          role="combobox"
          aria-haspopup="listbox"
          aria-owns={`${comboBoxId}-item-list`}
          aria-expanded={expanded}
          aria-controls={`${comboBoxId}-item-list`}
          aria-labelledby={comboBoxId + '-label'}
        >
          <div className="combo-box-input-container" role="presentation">
            {multiSelect !== true && selections.length > 0 && (
              <Pill
                id={`pill-${comboBoxId}`}
                label={selections[0].label}
                ariaLabelPrefix={ariaLabelPrefix ?? undefined}
                value={selections[0].value}
                wrapText={wrapPills}
                onKeyDown={(ev) => handleKeyDown(ev, 0)}
                onClick={handleSingleSelectPillClick}
                disabled={comboboxDisabled}
                ref={singleSelectionPillRef}
              ></Pill>
            )}
            <input
              {...otherProps}
              id={`${comboBoxId}-combo-box-input`}
              data-testid="combo-box-input"
              className={getInputClassName()}
              onChange={handleInputFilter}
              onKeyDown={(ev) => handleKeyDown(ev, 0)}
              onClick={openDropdown}
              onFocus={handleOnInputFocus}
              disabled={comboboxDisabled}
              aria-label={`${ariaLabelPrefix ? ariaLabelPrefix + ': ' : ''}Enter text to filter options. Use up and down arrows to open dropdown list.`}
              aria-describedby={`${comboBoxId}-aria-description`}
              aria-live={props['aria-live'] ?? undefined}
              aria-autocomplete="list"
              aria-activedescendant={currentListItem ?? ''}
              ref={filterRef}
            />
          </div>
          <Button
            id={`${comboBoxId}-expand`}
            className="expand-button"
            uswdsStyle={UswdsButtonStyle.Unstyled}
            onClick={handleToggleDropdown}
            onKeyDown={(ev) => handleKeyDown(ev, 0)}
            disabled={comboboxDisabled}
            tabIndex={-1}
            type="button"
            aria-label="expand dropdown of combo box"
          >
            <Icon name={expandIcon}></Icon>
          </Button>
        </div>
        {!comboboxDisabled && (
          <div
            className={`item-list-container ${expandedClass}`}
            id={`${comboBoxId}-item-list-container`}
            aria-hidden={expanded}
            tabIndex={-1}
            style={dropdownLocation ?? undefined}
          >
            <ul
              id={`${comboBoxId}-item-list`}
              role="listbox"
              aria-multiselectable={multiSelect === true ? 'true' : 'false'}
            >
              {filteredOptions.map((option, idx) => (
                <li
                  id={`option-${option.value}`}
                  className={setListItemClass(idx, option)}
                  role="option"
                  aria-hidden={option.hidden ? 'true' : 'false'}
                  data-value={option.value}
                  data-testid={`${comboBoxId}-option-item-${idx}`}
                  key={`${comboBoxId}-${idx}`}
                  onClick={() => handleDropdownItemSelection(option, isSelected(option))}
                  onKeyDown={(ev) => handleKeyDown(ev, idx + 1, option, isSelected(option))}
                  tabIndex={expanded ? 0 : -1}
                  aria-selected={isSelected(option) ? 'true' : undefined}
                  aria-label={`${multiSelect === true ? 'multi-select' : 'single-select'} option: ${ariaLabelPrefix ?? ''} ${option.label} ${isSelected(option)! ? 'selected' : 'unselected'}`}
                >
                  {
                    <>
                      {option.label}
                      {isSelected(option) && <Icon name="check"></Icon>}
                    </>
                  }
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
