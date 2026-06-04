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

const DROPDOWN_POSITION_THRESHOLD_RATIO = 0.5; // Show dropdown above input when element is in bottom half of viewport

function getVisibleOptions(
  options: ComboOption[],
  filter: string | null,
  disableFiltering: boolean | undefined,
): ComboOption[] {
  if (disableFiltering || !filter || !filter.trim()) {
    return options;
  }
  const normalizedFilter = filter.trim().toLowerCase();
  return options.filter((option) => option.label.toLowerCase().includes(normalizedFilter));
}

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
  hideInternalLabel?: boolean;
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
  disableFiltering?: boolean;
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
    hideInternalLabel,
    options: _options,
    selections,
    singularLabel,
    pluralLabel,
    overflowStrategy,
    errorMessage,
    hideClearAllButton,
    placeholder,
    scrollToSelected,
    disableFiltering,
    ...otherProps
  } = props;

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

  const comboBoxRef = useRef(null);
  const comboBoxListRef = useRef<HTMLUListElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const selectedMapRef = useRef<Map<string, ComboOption>>(selectedMap);

  // Keep ref in sync with state
  useEffect(() => {
    selectedMapRef.current = selectedMap;
  }, [selectedMap]);

  useOutsideClick([comboBoxRef], isOutsideClick);

  function clearFilter() {
    setFilter(null);
  }

  function closeDropdown(shouldFocus: boolean = true, selectionsToClose?: ComboOption[]) {
    setExpanded(false);
    clearFilter();
    if (shouldFocus) {
      focusInput();
    }
    if (onClose) {
      onClose(selectionsToClose ?? [...selectedMap.values()]);
    }
  }

  function openDropdown() {
    setExpanded(true);
    setCurrentListItem(null);
    // Don't clear filter on open - let it be cleared when user starts typing
    // Don't focus input here - let caller decide if focus is needed
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
    return Array.from(selectedMapRef.current.values());
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
        targetY > containerBottom ||
        selectedMap.size === 0
      ) {
        closeDropdown(false);
      }
    }
  }

  function getInputClassName(): string {
    const classes = ['usa-tooltip', 'combo-box-input'];
    if (overflowStrategy === 'ellipsis') {
      classes.push('ellipsis');
    }
    return classes.join(' ');
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
    const list = listRef.current;
    const listContainer = list?.parentElement;

    if (!list || !listContainer) {
      console.warn('List ref not available for navigation');
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

    // Validate array bounds before accessing
    if (targetIndex < 0 || targetIndex >= list.children.length) {
      console.warn('Invalid target index for list navigation');
      return;
    }

    const target = list.children[targetIndex];
    if (target instanceof HTMLElement) {
      const preventScroll = !elementIsVerticallyScrollable(listContainer, list);
      target.focus({ preventScroll });
      return target.id;
    }
  };

  function handleClearAllClick() {
    clearSelections();
    clearFilter();
    focusInput();

    if (onUpdateSelection) {
      onUpdateSelection([]);
    }
  }

  function handleDropdownItemSelection(option: ComboOption) {
    // Create a new Map to avoid mutating state directly
    const nextSelectedMap = new Map(selectedMap);

    if (nextSelectedMap.has(option.value)) {
      nextSelectedMap.delete(option.value);
    } else {
      if (!multiSelect) {
        nextSelectedMap.clear();
      }
      nextSelectedMap.set(option.value, option);
    }

    // Update the ref immediately so getSelections() returns the new value
    selectedMapRef.current = nextSelectedMap;
    setSelectedMap(nextSelectedMap);

    if (onUpdateSelection) {
      onUpdateSelection([...nextSelectedMap.values()]);
    }

    if (!multiSelect) {
      closeDropdown(true, [...nextSelectedMap.values()]);
    }
  }

  function handleInputFilter(ev: React.ChangeEvent<HTMLInputElement>) {
    openDropdown();
    setFilter(ev.target.value);
    if (onUpdateFilter) {
      onUpdateFilter(ev.target.value);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent, index: number, option?: ComboOption) {
    switch (event.key) {
      case 'Tab':
        // If has filter text and currently focused on input, check if there are filtered results
        if (filter && filter.trim().length > 0 && index === 0) {
          const filteredOptions = getVisibleOptions(_options, filter, disableFiltering);

          // Only move focus to first item if there are actually filtered results
          if (filteredOptions.length > 0) {
            event.preventDefault(); // Prevent default tab behavior
            event.stopPropagation();
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
        event.preventDefault();
        event.stopPropagation();
        closeDropdown(true);
        setCurrentListItem(null);
        break;
      case 'ArrowDown': {
        event.preventDefault();
        event.stopPropagation();
        const newId = navigateList('down', index - 1, comboBoxListRef);
        if (newId) {
          setCurrentListItem(newId);
        }
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        event.stopPropagation();
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
        if (
          event.target instanceof HTMLInputElement &&
          !event.target.classList.contains('combo-box-input')
        ) {
          if (option) {
            handleDropdownItemSelection(option);
            // Keep focus on the current item after toggling selection
            // so screen reader announces the new selected/unselected state
          }
          event.preventDefault();
        } else if (!(event.target instanceof HTMLInputElement)) {
          if (option) {
            handleDropdownItemSelection(option);
          }
          event.preventDefault();
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
    // Don't stopPropagation - let click bubble to container to trigger toggle
  }

  const isAlphanumeric = (key: string) => /^[a-zA-Z0-9]$/.test(key);

  function handleToggleButtonKeyDown(ev: React.KeyboardEvent) {
    if (comboboxDisabled) {
      return;
    }

    // Check for alphanumeric keys to open dropdown and start filtering
    if (!expanded && isAlphanumeric(ev.key)) {
      ev.preventDefault();
      ev.stopPropagation();
      setToggleKey(ev.key);
      handleToggleDropdown();
    } else {
      // For other keys, delegate to handleKeyDown
      handleKeyDown(ev, 0);
    }
  }

  function handleInputKeyDown(ev: React.KeyboardEvent) {
    if (comboboxDisabled) {
      return;
    }

    switch (ev.key) {
      case 'Enter':
        // Enter toggles dropdown open/closed
        ev.preventDefault();
        handleToggleDropdown();
        break;
      case 'ArrowDown':
        if (!expanded) {
          // Closed: open dropdown
          handleToggleDropdown();
        } else {
          // Open: delegate to handleKeyDown for navigation
          handleKeyDown(ev, 0);
        }
        break;
      case 'Escape':
        if (expanded) {
          ev.preventDefault();
          ev.stopPropagation();
          closeDropdown(true);
          setCurrentListItem(null);
        }
        break;
      case 'Tab':
      case 'ArrowUp':
        // Delegate to handleKeyDown
        handleKeyDown(ev, 0);
        break;
      default:
        // For other keys, if dropdown is open, delegate to handleKeyDown
        if (expanded) {
          handleKeyDown(ev, 0);
        }
        break;
    }
  }

  function handleToggleDropdown() {
    if (comboboxDisabled) {
      return;
    }

    const inputContainer = document.querySelector(`#${comboBoxId} .input-container`);
    if (!inputContainer) {
      console.warn(`Input container not found for combobox: ${comboBoxId}`);
      setDropdownLocation(null);
      if (!expanded) {
        openDropdown();
        focusInput();
      } else {
        closeDropdown();
      }
      return;
    }

    const topYPos = inputContainer.getBoundingClientRect().top;
    const bottomYPos = inputContainer.getBoundingClientRect().bottom;
    const windowMiddle = window.innerHeight * DROPDOWN_POSITION_THRESHOLD_RATIO;

    if (topYPos > windowMiddle) {
      const inputHeight = bottomYPos - topYPos;
      setDropdownLocation({ bottom: inputHeight });
    } else {
      setDropdownLocation(null);
    }

    if (expanded) {
      closeDropdown();
    } else {
      openDropdown();
      focusInput();
    }
  }

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
          if (!firstSelected || !comboBoxListRef.current) return;

          const selectedElement = comboBoxListRef.current.querySelector(
            `li[data-value="${firstSelected.value}"]`,
          );

          if (
            selectedElement instanceof HTMLElement &&
            typeof selectedElement.scrollIntoView === 'function'
          ) {
            try {
              selectedElement.scrollIntoView({ block: 'nearest', behavior: 'auto' });
            } catch (error) {
              console.warn('Failed to scroll to selected element', error);
            }
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
        selections?.map((selection) => {
          return [selection.value, selection];
        }),
      ),
    );
  }, [selections]);

  useEffect(() => {
    setComboboxDisabled(!!disabled);
  }, [disabled]);

  useImperativeHandle(ref, () => ({
    setSelections,
    getSelections,
    clearSelections,
    disable,
    focusInput,
    focus: focusInput,
  }));

  return (
    <div
      id={comboBoxId}
      className={`usa-form-group combo-box-form-group ${otherProps.className ?? ''}`}
      ref={comboBoxRef}
    >
      <div className={`combo-box-label ${multiSelect === true ? 'multi-select' : 'single-select'}`}>
        <label
          className="usa-label"
          id={comboBoxId + '-label'}
          htmlFor={`${comboBoxId}-combo-box-input`}
          aria-hidden={hideInternalLabel ? 'true' : undefined}
        >
          {label} {otherProps.required && <span className="required-form-field">*</span>}
        </label>
      </div>
      {ariaDescription && (
        <div className="usa-hint" id={`${comboBoxId}-hint`}>
          {ariaDescription}
        </div>
      )}
      <div className="usa-combo-box">
        <span id={`${comboBoxId}-filter-input-aria-description`} hidden>
          Enter text to filter options. Use up and down arrows to select a filtered item from the
          list.
        </span>
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
        <div
          className={`input-container usa-input ${comboboxDisabled ? 'disabled' : ''} ${errorMessage && errorMessage.length > 0 ? 'usa-input-group--error' : ''}`}
          onClick={() => !comboboxDisabled && !expanded && openDropdown()}
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
              aria-describedby={`${comboBoxId}-filter-input-aria-description`}
              aria-autocomplete="list"
              aria-activedescendant={currentListItem ?? ''}
              aria-live="off"
              aria-atomic="false"
              value={filter !== null ? filter : selectedMap.size > 0 ? getSelectedLabel() : ''}
              placeholder={!expanded && selectedMap.size === 0 ? placeholder : undefined}
              onChange={handleInputFilter}
              onKeyDown={handleInputKeyDown}
              onFocus={handleOnInputFocus}
              onClick={handleOnInputClick}
              disabled={comboboxDisabled}
              autoComplete={'off'}
              tabIndex={0}
              ref={filterRef}
            />
          </div>
          <Button
            id={`${comboBoxId}-expand`}
            data-testid={`${comboBoxId}-expand`}
            className="expand-button"
            uswdsStyle={UswdsButtonStyle.Unstyled}
            onClick={() => handleToggleDropdown()}
            onKeyDown={handleToggleButtonKeyDown}
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
              aria-label={`${label} ${multiSelect ? 'multi-select' : 'single-select'} options`}
              aria-multiselectable={multiSelect === true ? 'true' : 'false'}
              aria-live="off"
              ref={comboBoxListRef}
            >
              {/* eslint-disable jsx-a11y/role-has-required-aria-props */}
              {getVisibleOptions(_options, filter, disableFiltering).map((option, idx) => (
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
      <div aria-live="off" aria-atomic="false">
        {selectedMap.size > 0 && !hideClearAllButton && (
          <Button
            className="clear-all-button"
            uswdsStyle={UswdsButtonStyle.Unstyled}
            onClick={handleClearAllClick}
            id={`${comboBoxId}-clear-all`}
            aria-label={`Clear all ${label ?? ''} items selected.`}
          >
            Clear
          </Button>
        )}
      </div>
      {errorMessage && errorMessage.length > 0 && (
        <div id={`${comboBoxId}-input__error-message`} className="usa-input__error-message">
          {errorMessage}
        </div>
      )}
    </div>
  );
}

const ComboBox = forwardRef(ComboBox_);
export default ComboBox;
