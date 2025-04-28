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
  divider?: boolean;
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
    value,
    options: _options,
    ...otherProps
  } = props;

  // ========== STATE ==========

  const [comboboxDisabled, setComboboxDisabled] = useState<boolean>(
    disabled !== undefined ? !!disabled : false,
  );

  const [expandIcon, setExpandIcon] = useState<string>('expand_more');
  const [expanded, setExpanded] = useState<boolean>(false);
  const [expandedClass, setExpandedClass] = useState<string>('closed');
  const [dropdownLocation, setDropdownLocation] = useState<{ bottom: number } | null>(null);
  const [currentListItem, setCurrentListItem] = useState<string | undefined>(undefined);
  const [shouldFocusSingleSelectPill, setShouldFocusSingleSelectPill] = useState<boolean>(false);
  const [options, setOptions] = useState<ComboOption[]>(props.options);
  const [selections, setSelections] = useState<ComboOption[]>(
    props.options.filter((option) => option.selected),
  );
  const [filter, setFilter] = useState<string | null>(null);

  // ========== REFS ==========

  const comboBoxRef = useRef(null);
  const comboBoxListRef = useRef<HTMLUListElement>(null);
  const pillBoxRef = useRef(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const singleSelectionPillRef = useRef<HTMLButtonElement>(null);

  useOutsideClick([comboBoxRef], isOutsideClick);

  // ========== MISC FUNCTIONS ==========

  function clearFilter() {
    setFilter(null);
    if (filterRef.current) {
      filterRef.current.value = '';
    }
  }

  function closeDropdown(shouldFocusOnInput: boolean = true, freshSelections: ComboOption[] = []) {
    setExpandIcon('expand_more');
    setExpanded(false);
    setExpandedClass('closed');
    clearFilter();
    if (shouldFocusOnInput) {
      if (!multiSelect && (selections.length > 0 || freshSelections.length > 0)) {
        setShouldFocusSingleSelectPill(true);
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

  function setValue(values: ComboOption[]) {
    const newOptions = options.map((option) => {
      return {
        ...option,
        selected: !!values.find(
          (value) => value.value.toLowerCase() === option.value.toLowerCase(),
        ),
      };
    });
    setOptions(newOptions);
    setSelections(newOptions.filter((option) => option.selected));
  }

  function clearValue() {
    setOptions(options.map((option) => ({ ...option, selected: false })));
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
        selections.length === 0
      ) {
        closeDropdown(false);
      }
    }
  }

  function isSelected(option: ComboOption) {
    return !!selections.find((item) => item.value === option.value && item.label === option.label);
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
    if (option.divider) {
      classNames.push('divider');
    }
    return classNames.join(' ');
  }

  const navigateList = (
    direction: 'up' | 'down',
    currentIndex: number,
    listRef: React.RefObject<HTMLUListElement>,
  ) => {
    const list = listRef.current;
    const listContainer = list?.parentElement;
    if (!(list && listContainer)) {
      return;
    }

    let targetIndex = currentIndex;
    const total = list.children.length;
    do {
      targetIndex =
        direction === 'down' ? Math.min(targetIndex + 1, total - 1) : Math.max(targetIndex - 1, 0);
    } while (
      targetIndex >= 0 &&
      targetIndex < total &&
      list.children[targetIndex].classList.contains('hidden')
    );

    const target = list.children[targetIndex] as HTMLElement;
    if (target) {
      const preventScroll = !elementIsVerticallyScrollable(listContainer, list);
      target.focus({ preventScroll });
      return target.id;
    }
  };

  // ========== HANDLERS ==========

  function handleClearAllClick() {
    clearValue();
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
    let newSelections: ComboOption[] = [];
    if (multiSelect) {
      const startingLength = selections.length;
      newSelections = selections.filter((item) => item.value !== option.value);
      if (startingLength === newSelections.length) {
        newSelections.push(option);
      }
    } else if (selections.length === 1 && selections[0].value === option.value) {
      newSelections = [];
    } else {
      newSelections = [option];
    }

    setValue(newSelections);

    if (onUpdateSelection) {
      onUpdateSelection(newSelections);
    }

    if (!multiSelect) {
      closeDropdown(true, newSelections);
    }
  }

  function handleInputFilter(ev: React.ChangeEvent<HTMLInputElement>) {
    openDropdown();
    setFilter(ev.target.value);
    // TODO: Do we need to call a callback when the filter is updated?
    if (onUpdateFilter) {
      onUpdateFilter(ev.target.value);
    }
  }

  function handleKeyDown(ev: React.KeyboardEvent, index: number, option?: ComboOption) {
    switch (ev.key) {
      case 'Tab':
        closeDropdown(false);
        setCurrentListItem(undefined);
        break;
      case 'Escape':
        closeDropdown(true);
        setCurrentListItem(undefined);
        ev.preventDefault();
        break;
      case 'ArrowDown': {
        ev.preventDefault();
        ev.stopPropagation();
        openDropdown();
        const newId = navigateList('down', index - 1, comboBoxListRef);
        if (newId) {
          setCurrentListItem(newId);
        }
        break;
      }
      case 'ArrowUp': {
        ev.preventDefault();
        ev.stopPropagation();
        openDropdown();
        if (index <= 1) {
          // Depending on context, move focus to input or single select pill
          const element =
            selections.length && !multiSelect ? singleSelectionPillRef.current : filterRef.current;
          if (element) {
            element.focus();
          }
          setCurrentListItem(undefined);
          closeDropdown(true);
        } else {
          const newId = navigateList('up', index - 1, comboBoxListRef);
          if (newId) {
            setCurrentListItem(newId);
          }
        }
        break;
      }
      case 'Enter':
      case ' ':
        if (!(ev.target as HTMLInputElement).classList.contains('combo-box-input')) {
          handleDropdownItemSelection(option as ComboOption);
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
    setValue(selections);
    if (onUpdateSelection) {
      onUpdateSelection(selections);
    }
    if (onPillSelection) {
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
    setOptions(props.options);
  }, [props.options]);

  useEffect(() => {
    if (props.onUpdateSelection) {
      props.onUpdateSelection(selections);
    }
  }, [selections]);

  useEffect(() => {
    if (!props.value) {
      setValue([]);
      return;
    }

    if (props.value instanceof Array) {
      const values = props.value as string[];
      setValue(options.filter((option) => values.includes(option.value)));
    } else {
      const option = options.find((option) => option.value === props.value);
      if (option) {
        setValue([option]);
      }
    }
  }, [props.value]);

  useEffect(() => {
    if (comboboxDisabled && onDisable) {
      onDisable();
    } else if (!comboboxDisabled && onEnable) {
      onEnable();
    }
  }, [comboboxDisabled]);

  useEffect(() => {
    if (shouldFocusSingleSelectPill && singleSelectionPillRef.current) {
      singleSelectionPillRef.current.focus();
      setShouldFocusSingleSelectPill(false);
    }
  }, [shouldFocusSingleSelectPill]);

  useImperativeHandle(ref, () => ({
    setValue,
    getValue: () => selections,
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
            selections={selections}
            onSelectionChange={handlePillSelection}
            disabled={comboboxDisabled}
            ref={pillBoxRef}
          ></PillBox>
          {selections.length > 0 && (
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
            {multiSelect === false && selections.length === 1 && (
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
              ref={comboBoxListRef}
            >
              {options
                .filter(
                  (option) => !filter || option.label.toLowerCase().includes(filter.toLowerCase()),
                )
                .map((option, idx) => (
                  <li
                    id={`option-${option.value}`}
                    className={setListItemClass(idx, option)}
                    role="option"
                    aria-hidden={option.hidden ? 'true' : 'false'}
                    data-value={option.value}
                    data-testid={`${comboBoxId}-option-item-${idx}`}
                    key={`${comboBoxId}-${idx}`}
                    onClick={() => handleDropdownItemSelection(option)}
                    onKeyDown={(ev) => handleKeyDown(ev, idx + 1, option)}
                    tabIndex={expanded ? 0 : -1}
                    aria-selected={isSelected(option) ? 'true' : undefined}
                    aria-label={`${multiSelect === true ? 'multi-select' : 'single-select'} option: ${ariaLabelPrefix ?? ''} ${option.label} ${isSelected(option) ? 'selected' : 'unselected'}`}
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
