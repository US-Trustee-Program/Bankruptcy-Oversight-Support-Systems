import '../uswds/forms.scss';
import './ComboBox.scss';
import React, {
  forwardRef,
  PropsWithChildren,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type JSX,
} from 'react';
import Icon from '../uswds/Icon';
import Button, { UswdsButtonStyle } from '../uswds/Button';
import useOutsideClick from '@/lib/hooks/UseOutsideClick';
import { ComboBoxRef } from '@/lib/type-declarations/input-fields';

export type ComboOption<T = string> = {
  value: T;
  label: string;
  selectedLabel?: string;
  divider?: boolean;
  isAriaDefault?: boolean;
};

export type ComboOptionList<T = string> = ComboOption<T> | Array<ComboOption<T>>;

type InputProps = JSX.IntrinsicElements['input'] &
  JSX.IntrinsicElements['select'] &
  PropsWithChildren;

export interface ComboBoxProps extends Omit<InputProps, 'onChange' | 'onFocus' | 'value'> {
  id: string;
  label?: string;
  ariaLabelPrefix?: string;
  ariaDescription?: string;
  autoComplete?: 'off';
  icon?: string;
  options: ComboOption[];
  selections?: ComboOption[];
  onUpdateSelection?: (options: ComboOption[]) => void;
  onUpdateFilter?: (value: string) => void;
  onClose?: (options: ComboOption[]) => void;
  onFocus?: (ev: React.FocusEvent<HTMLElement>) => void;
  multiSelect?: boolean;
  wrapPills?: boolean;
  singularLabel?: string;
  pluralLabel?: string;
  overflowStrategy?: 'ellipsis';
  errorMessage?: string;
  hideClearAllButton?: boolean;
  placeholder?: string;
  scrollToSelected?: boolean;
}

function ComboBox_(props: ComboBoxProps, ref: React.Ref<ComboBoxRef>) {
  const {
    id: comboBoxId,
    label,
    disabled,
    onUpdateSelection,
    onUpdateFilter,
    onClose,
    multiSelect,
    wrapPills,
    ariaLabelPrefix,
    ariaDescription,
    options: _options,
    selections,
    singularLabel,
    pluralLabel,
    overflowStrategy,
    errorMessage,
    hideClearAllButton,
    placeholder,
    scrollToSelected,
    ...otherProps
  } = props;

  // ========== STATE ==========

  const [comboboxDisabled, setComboboxDisabled] = useState<boolean>(!!disabled);
  const [expanded, setExpanded] = useState<boolean>(false);
  const expandedRef = useRef<boolean>(false);
  const [toggleKey, setToggleKey] = useState<string | null>(null);
  const [dropdownLocation, setDropdownLocation] = useState<{ bottom: number } | null>(null);
  const [currentListItem, setCurrentListItem] = useState<string | null>(null);

  const [selectedMap, setSelectedMap] = useState<Map<string, ComboOption>>(
    new Map(
      selections?.map((selection) => {
        return [selection.value, selection];
      }),
    ),
  );
  const [filter, setFilter] = useState<string | null>(null);

  // ========== REFS ==========

  const comboBoxRef = useRef(null);
  const comboBoxListRef = useRef<HTMLUListElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useOutsideClick([comboBoxRef], isOutsideClick);

  // ========== MISC FUNCTIONS ==========

  function clearFilter() {
    setFilter(null);
    if (filterRef.current) {
      filterRef.current.value = '';
    }
  }

  function closeDropdown(shouldFocus: boolean = true) {
    setExpanded(false);
    clearFilter();
    if (shouldFocus) {
      focusCombobox();
    }
    if (onClose) {
      onClose([...selectedMap.values()]);
    }
  }

  function openDropdown() {
    setExpanded(true);
    setCurrentListItem(null);
    // Don't clear filter on open - let it be cleared when user starts typing
  }

  function disable(shouldDisable: boolean) {
    setComboboxDisabled(shouldDisable);
  }

  function elementIsVerticallyScrollable(parent: Element, child: Element) {
    const parentHeight = parent.getBoundingClientRect().height ?? 0;
    const childHeight = child.getBoundingClientRect().height ?? 0;
    return childHeight > parentHeight;
  }

  function getSelections() {
    return Array.from(selectedMap.values());
  }

  function setSelections(values: ComboOption[]) {
    setSelectedMap(new Map(values.map((value) => [value.value, value])));
    props?.onUpdateSelection?.(values);
  }

  function clearSelections() {
    setSelectedMap(new Map());
  }

  const focusInput = () => {
    requestAnimationFrame(() => {
      filterRef.current?.focus();
    });
  };

  function getSelectedLabel() {
    if (selectedMap.size === 0) {
      return placeholder ?? '';
    } else if (selectedMap.size === 1) {
      const selected = [...selectedMap.values()][0];
      // For single selections: use selectedLabel if present (e.g., "Alaska" for districts)
      // Otherwise use the full label as-is
      return selected.selectedLabel ?? selected.label;
    } else {
      // Don't include "selected" - screen reader prepends "selected" when announcing the input value
      return `${selectedMap.size} ${pluralLabel}`;
    }
  }

  function isOutsideClick(ev: MouseEvent) {
    if (comboBoxRef.current && expandedRef.current) {
      const boundingRect = (comboBoxRef.current as HTMLDivElement).getBoundingClientRect();
      const containerRight = boundingRect.x + boundingRect.width;
      const containerBottom = boundingRect.y + boundingRect.height;
      const targetX = ev.clientX;
      const targetY = ev.clientY;
      // Close if click is outside the combobox bounds
      if (
        targetX < boundingRect.x ||
        targetX > containerRight ||
        targetY < boundingRect.y ||
        targetY > containerBottom
      ) {
        closeDropdown(false);
      }
    }
  }

  function getInputClassName(): string {
    return 'usa-tooltip combo-box-input';
  }

  function setListItemClass(_index: number, option: ComboOption) {
    const classNames = [];
    if (selectedMap.size > 0 && selectedMap.has(option.value)) {
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
    listRef: React.RefObject<HTMLUListElement | null>,
  ) => {
    const list = listRef.current!;
    const listContainer = list.parentElement!;

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

  function focusCombobox() {
    requestAnimationFrame(() => {
      containerRef.current?.focus();
    });
  }

  // ========== HANDLERS ==========

  function handleClearAllClick() {
    clearSelections();
    clearFilter();
    focusCombobox();

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
    if (selectedMap.has(option.value)) {
      selectedMap.delete(option.value);
    } else {
      if (!multiSelect) {
        selectedMap.clear();
      }
      selectedMap.set(option.value, option);
    }

    setSelectedMap(new Map(selectedMap));

    if (onUpdateSelection) {
      onUpdateSelection([...selectedMap.values()]);
    }

    if (!multiSelect) {
      closeDropdown(true);
    }
  }

  function handleInputFilter(ev: React.ChangeEvent<HTMLInputElement>) {
    openDropdown();
    setFilter(ev.target.value);
    if (onUpdateFilter) {
      onUpdateFilter(ev.target.value);
    }
  }

  function handleKeyDown(ev: React.KeyboardEvent, index: number, option?: ComboOption) {
    switch (ev.key) {
      case 'Tab':
        // If has filter text and currently focused on input, check if there are filtered results
        if (filter && filter.trim().length > 0 && index === 0) {
          const filteredOptions = props.options.filter((option) =>
            option.label.toLowerCase().includes(filter.toLowerCase()),
          );

          // Only move focus to first item if there are actually filtered results
          if (filteredOptions.length > 0) {
            ev.preventDefault(); // Prevent default tab behavior
            ev.stopPropagation();
            // Behave like ArrowDown - move to first item in the list
            const newId = navigateList('down', index - 1, comboBoxListRef);
            if (newId) {
              setCurrentListItem(newId);
            }
            return;
          }
        }
        // If already on a list item, no filter text, or no filtered results, close dropdown and allow normal tab behavior
        closeDropdown(false);
        setCurrentListItem(null);
        // Don't prevent default - let Tab move to next element naturally
        break;
      case 'Escape':
        ev.preventDefault();
        ev.stopPropagation();
        closeDropdown(true);
        setCurrentListItem(null);
        break;
      case 'ArrowDown': {
        ev.preventDefault();
        ev.stopPropagation();
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
        if (document.activeElement === filterRef.current) {
          setCurrentListItem(null);
          closeDropdown();
        } else if (index <= 1) {
          focusInput();
          setCurrentListItem(null);
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
          if (option) {
            handleDropdownItemSelection(option);
            // Keep focus on the current item after toggling selection
            // so screen reader announces the new selected/unselected state
          }
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

  function handleOnInputClick(ev: React.MouseEvent<HTMLInputElement>) {
    ev.currentTarget.focus();
    ev.preventDefault();
    ev.stopPropagation();
  }

  function handleKeyDownOnToggleButton(ev: React.KeyboardEvent) {
    if (comboboxDisabled) {
      return;
    }

    switch (ev.key) {
      case 'Tab':
        // Close dropdown and allow normal tab behavior
        if (expanded) {
          closeDropdown(false);
          setCurrentListItem(null);
        }
        // Don't prevent default - let Tab move to next element naturally
        break;
      case 'ArrowDown':
        if (!expanded) {
          // Closed: open dropdown
          handleToggleDropdown();
        } else {
          // Open: move into list (navigate to first item)
          ev.preventDefault();
          ev.stopPropagation();
          const newId = navigateList('down', -1, comboBoxListRef);
          if (newId) {
            setCurrentListItem(newId);
          }
        }
        break;
      case 'Enter':
        // Toggle dropdown (open/close)
        handleToggleDropdown();
        break;
      case 'ArrowUp':
        ev.preventDefault();
        ev.stopPropagation();
        // No action on ArrowUp from input (matches old ComboBox)
        break;

      default:
        if (!expanded && isAlphanumeric(ev.key)) {
          setToggleKey(ev.key);
          handleToggleDropdown();
        }
    }
  }

  const isAlphanumeric = (key: string) => /^[a-zA-Z0-9]$/.test(key);

  function handleToggleDropdown() {
    if (comboboxDisabled) {
      return;
    }

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
  }

  // ========== USE EFFECTS ==========

  useEffect(() => {
    expandedRef.current = expanded;

    if (expanded) {
      setCurrentListItem(null);
      // Don't clear filter here - keep showing selected label until user types
      focusInput();

      // Scroll to first selected item if there are selections (only on open, not on selection changes)
      if (scrollToSelected && selectedMap.size > 0 && comboBoxListRef.current) {
        requestAnimationFrame(() => {
          const firstSelected = Array.from(selectedMap.values())[0];
          if (!firstSelected) return;

          const selectedElement = comboBoxListRef.current?.querySelector(
            `li[data-value="${firstSelected.value}"]`,
          ) as HTMLElement;

          if (selectedElement && typeof selectedElement.scrollIntoView === 'function') {
            selectedElement.scrollIntoView({ block: 'nearest', behavior: 'auto' });
          }
        });
      }
    }
  }, [expanded]);

  useEffect(() => {
    if (expanded && toggleKey && filterRef.current) {
      setFilter(toggleKey);
      if (onUpdateFilter) {
        onUpdateFilter(toggleKey);
      }
      filterRef.current.setSelectionRange(1, 1);
      filterRef.current.focus();
      setToggleKey(null);
    }
  }, [expanded, toggleKey, setFilter, onUpdateFilter]);

  useEffect(() => {
    setSelectedMap(
      new Map(
        props.selections?.map((selection) => {
          return [selection.value, selection];
        }),
      ),
    );
  }, [props.selections]);

  useEffect(() => {
    setComboboxDisabled(!!disabled);
  }, [disabled]);

  useImperativeHandle(ref, () => ({
    setSelections,
    getSelections,
    clearSelections,
    disable,
    focusInput,
    focus: focusCombobox,
  }));

  // ========== JSX ==========

  return (
    <div
      id={comboBoxId}
      className={`usa-form-group combo-box-form-group ${props.className ?? ''}`}
      ref={comboBoxRef}
    >
      <div className={`combo-box-label ${multiSelect === true ? 'multi-select' : 'single-select'}`}>
        <label
          className="usa-label"
          id={comboBoxId + '-label'}
          htmlFor={`${comboBoxId}-combo-box-input`}
        >
          {label} {props.required && <span className="required-form-field">*</span>}
        </label>
      </div>
      {ariaDescription && (
        <div className="usa-hint" id={`${comboBoxId}-hint`}>
          {ariaDescription}
        </div>
      )}
      <div className="usa-combo-box">
        <span id={`${comboBoxId}-instructions`} hidden>
          Enter text to filter options. Use up and down arrows to select a filtered item from the
          list.
        </span>
        <div
          className={`input-container usa-input ${comboboxDisabled ? 'disabled' : ''} ${errorMessage && errorMessage.length > 0 ? 'usa-input-group--error' : ''}`}
        >
          <div className="combo-box-input-container" role="presentation">
            <Icon name="search"></Icon>
            <input
              {...otherProps}
              id={`${comboBoxId}-combo-box-input`}
              data-testid="combo-box-input"
              className={getInputClassName()}
              role="combobox"
              aria-haspopup="listbox"
              aria-expanded={expanded}
              aria-controls={`${comboBoxId}-item-list`}
              aria-labelledby={comboBoxId + '-label'}
              aria-describedby={`${comboBoxId}-instructions`}
              aria-autocomplete="list"
              aria-activedescendant={currentListItem ?? ''}
              aria-live="off"
              aria-atomic="false"
              value={filter !== null ? filter : selectedMap.size > 0 ? getSelectedLabel() : ''}
              placeholder={!expanded && selectedMap.size === 0 ? placeholder : undefined}
              onChange={handleInputFilter}
              onKeyDown={handleKeyDownOnToggleButton}
              onFocus={handleOnInputFocus}
              onClick={handleOnInputClick}
              disabled={comboboxDisabled}
              autoComplete={'off'}
              ref={filterRef}
            />
          </div>
          <Button
            id={`${comboBoxId}-expand`}
            data-testid={`${comboBoxId}-expand`}
            className="expand-button"
            uswdsStyle={UswdsButtonStyle.Unstyled}
            onClick={() => handleToggleDropdown()}
            onKeyDown={(ev) => handleKeyDown(ev, 0)}
            disabled={comboboxDisabled}
            tabIndex={-1}
            type="button"
            aria-disabled={comboboxDisabled}
            aria-label={`Toggle ${label || 'dropdown'} options`}
            aria-hidden="true"
          >
            <Icon name={expanded ? 'expand_less' : 'expand_more'}></Icon>
          </Button>
        </div>
        {!comboboxDisabled && (
          <div
            className={`item-list-container ${expanded ? 'expanded' : 'closed'}`}
            id={`${comboBoxId}-item-list-container`}
            aria-hidden={!expanded}
            aria-live="off"
            aria-atomic="false"
            tabIndex={-1}
            style={dropdownLocation ?? undefined}
          >
            <ul
              id={`${comboBoxId}-item-list`}
              role="listbox"
              aria-label={`${label} options`}
              aria-multiselectable={multiSelect === true ? 'true' : 'false'}
              aria-live="off"
              ref={comboBoxListRef}
            >
              {/* eslint-disable jsx-a11y/role-has-required-aria-props */}
              {props.options
                .filter(
                  (option) => !filter || option.label.toLowerCase().includes(filter.toLowerCase()),
                )
                .map((option, idx) => (
                  <li
                    id={`option-${option.value}`}
                    className={setListItemClass(idx, option)}
                    role="option"
                    data-value={option.value}
                    data-testid={`${comboBoxId}-option-item-${idx}`}
                    key={`${comboBoxId}-${idx}`}
                    onClick={() => handleDropdownItemSelection(option)}
                    onKeyDown={(ev) => handleKeyDown(ev, idx + 1, option)}
                    tabIndex={expanded ? 0 : -1}
                    aria-label={
                      (option.isAriaDefault ? 'Default ' : '') +
                      (ariaLabelPrefix ? ariaLabelPrefix + ' ' : '') +
                      option.label +
                      (selectedMap.has(option.value) ? ', selected' : ', not selected')
                    }
                  >
                    <span aria-hidden="true">
                      {option.label}
                      {selectedMap.has(option.value) && <Icon name="check"></Icon>}
                    </span>
                  </li>
                ))}
              {/* eslint-enable jsx-a11y/role-has-required-aria-props */}
            </ul>
          </div>
        )}
      </div>
      {selectedMap.size > 0 && !hideClearAllButton && (
        <Button
          className="clear-all-button"
          uswdsStyle={UswdsButtonStyle.Unstyled}
          onClick={handleClearAllClick}
          onKeyDown={handleClearAllKeyDown}
          id={`${comboBoxId}-clear-all`}
          aria-label={`Clear all ${label ?? ''} items selected.`}
        >
          Clear
        </Button>
      )}
      {errorMessage && errorMessage.length > 0 && (
        <div id={`${props.id}-input__error-message`} className="usa-input__error-message">
          {errorMessage}
        </div>
      )}
    </div>
  );
}

const ComboBox = forwardRef(ComboBox_);
export default ComboBox;
