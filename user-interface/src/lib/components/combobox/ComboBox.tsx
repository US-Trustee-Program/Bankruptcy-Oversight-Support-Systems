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
import useOutsideClick from '@/lib/hooks/UseOutsideClick';
import { ComboBoxRef } from '@/lib/type-declarations/input-fields';

export type ComboOption = {
  value: string;
  label: string;
  selectedLabel?: string;
  divider?: boolean;
  isAriaDefault?: boolean;
};

export type ComboOptionList = ComboOption | Array<ComboOption>;

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
  onUpdateSelection?: (options: ComboOption[]) => void;
  onUpdateFilter?: (value: string) => void;
  onClose?: (options: ComboOption[]) => void;
  onFocus?: (ev: React.FocusEvent<HTMLElement>) => void;
  multiSelect?: boolean;
  wrapPills?: boolean;
  singularLabel?: string;
  pluralLabel?: string;
  overflowStrategy?: 'ellipsis';
}

function ComboBoxComponent(props: ComboBoxProps, ref: React.Ref<ComboBoxRef>) {
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
    singularLabel,
    pluralLabel,
    overflowStrategy,
    ...otherProps
  } = props;

  // ========== STATE ==========

  const [comboboxDisabled, setComboboxDisabled] = useState<boolean>(!!disabled);
  const [expanded, setExpanded] = useState<boolean>(false);
  const [dropdownLocation, setDropdownLocation] = useState<{ bottom: number } | null>(null);
  const [currentListItem, setCurrentListItem] = useState<string | null>(null);

  const [selectedMap, setSelectedMap] = useState<Map<string, ComboOption>>(new Map());
  const [filter, setFilter] = useState<string | null>(null);

  // ========== REFS ==========

  const comboBoxRef = useRef(null);
  const comboBoxListRef = useRef<HTMLUListElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useOutsideClick([comboBoxRef], isOutsideClick);

  // ========== MISC FUNCTIONS ==========

  function buildAriaLabel(option: ComboOption) {
    const typeLabel = multiSelect === true ? 'multi-select' : 'single-select';
    const selectionLabel = selectedMap.has(option.value) ? 'selected' : 'unselected';
    const labelPrefix = option.isAriaDefault ? `Default ${singularLabel} ` : '';
    return `${labelPrefix}${typeLabel} option: ${ariaLabelPrefix ? ariaLabelPrefix + ' ' : ''}${option.label} ${selectionLabel}`;
  }

  function clearFilter() {
    setFilter(null);
    if (filterRef.current) {
      filterRef.current.value = '';
    }
  }

  function closeDropdown(shouldFocusOnInput: boolean = true) {
    setExpanded(false);
    clearFilter();
    if (shouldFocusOnInput) {
      filterRef.current?.focus();
    }
    if (onClose) {
      onClose([...selectedMap.values()]);
    }
  }

  function openDropdown() {
    setExpanded(true);
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
  }

  function clearSelections() {
    setSelectedMap(new Map());
  }

  const focusInput = () => {
    filterRef.current?.focus();
  };

  function getSelectedLabel() {
    if (selectedMap.size === 0) {
      return '';
    } else if (selectedMap.size === 1) {
      return [...selectedMap.values()][0].selectedLabel ?? [...selectedMap.values()][0].label;
    } else {
      return `${selectedMap.size} ${pluralLabel} selected`;
    }
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
        selectedMap.size === 0
      ) {
        closeDropdown(false);
      }
    }
  }

  function getSelectedClasses(): string {
    const classNames = ['selection-label'];
    if (overflowStrategy === 'ellipsis') {
      classNames.push(overflowStrategy);
    }
    return classNames.join(' ');
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
    listRef: React.RefObject<HTMLUListElement>,
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

  // ========== HANDLERS ==========

  function handleClearAllClick() {
    clearSelections();
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
        closeDropdown(false);
        setCurrentListItem(null);
        break;
      case 'Escape':
        closeDropdown(true);
        setCurrentListItem(null);
        ev.preventDefault();
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
          filterRef.current?.focus();
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
          handleDropdownItemSelection(option as ComboOption);
          setCurrentListItem(null);
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

  function handleToggleKeyDown(ev: React.KeyboardEvent) {
    if (!comboboxDisabled && ev.key === 'ArrowDown') {
      handleToggleDropdown();
    }
  }

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
    if (props.onUpdateSelection) {
      props.onUpdateSelection([...selectedMap.values()]);
    }
  }, [selectedMap]);

  useEffect(() => {
    if (expanded) {
      filterRef.current?.focus();
    } else {
      containerRef.current?.focus();
    }
  }, [expanded]);

  useImperativeHandle(ref, () => ({
    setSelections,
    getSelections,
    clearSelections,
    disable,
    focusInput,
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
        {selectedMap.size > 0 && (
          <Button
            className="clear-all-button"
            uswdsStyle={UswdsButtonStyle.Unstyled}
            onClick={handleClearAllClick}
            onKeyDown={handleClearAllKeyDown}
            id={`${comboBoxId}-clear-all`}
          >
            clear
          </Button>
        )}
      </div>
      <div className="usa-combo-box">
        <div
          className={`input-container usa-input ${comboboxDisabled ? 'disabled' : ''}`}
          role="combobox"
          aria-haspopup="listbox"
          aria-owns={`${comboBoxId}-item-list`}
          aria-expanded={expanded}
          aria-controls={`${comboBoxId}-item-list`}
          aria-labelledby={comboBoxId + '-label'}
          tabIndex={0}
          onClick={() => handleToggleDropdown()}
          onKeyDown={handleToggleKeyDown}
          ref={containerRef}
        >
          <div className="combo-box-input-container" role="presentation">
            {expanded ? (
              <>
                <Icon name="search"></Icon>
                <input
                  {...otherProps}
                  id={`${comboBoxId}-combo-box-input`}
                  data-testid="combo-box-input"
                  className={getInputClassName()}
                  onChange={handleInputFilter}
                  onKeyDown={(ev) => handleKeyDown(ev, 0)}
                  onFocus={handleOnInputFocus}
                  onClick={handleOnInputClick}
                  disabled={comboboxDisabled}
                  autoComplete={'off'}
                  aria-label={`${ariaLabelPrefix ? ariaLabelPrefix + ': ' : ''}Enter text to filter options. Use up and down arrows to open dropdown list.`}
                  aria-describedby={`${comboBoxId}-aria-description`}
                  aria-live={props['aria-live'] ?? undefined}
                  aria-autocomplete="list"
                  aria-activedescendant={currentListItem ?? ''}
                  ref={filterRef}
                />
              </>
            ) : (
              <span title={getSelectedLabel()} className={getSelectedClasses()}>
                {getSelectedLabel()}
              </span>
            )}
          </div>
          <Button
            id={`${comboBoxId}-expand`}
            className="expand-button"
            uswdsStyle={UswdsButtonStyle.Unstyled}
            onClick={() => handleToggleDropdown()}
            onKeyDown={(ev) => handleKeyDown(ev, 0)}
            disabled={comboboxDisabled}
            tabIndex={-1}
            type="button"
            aria-label="expand dropdown of combo box"
          >
            <Icon name={expanded ? 'expand_less' : 'expand_more'}></Icon>
          </Button>
        </div>
        {!comboboxDisabled && (
          <div
            className={`item-list-container ${expanded ? 'expanded' : 'closed'}`}
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
                    aria-selected={selectedMap.has(option.value) ? 'true' : undefined}
                    aria-label={buildAriaLabel(option)}
                  >
                    {
                      <>
                        {option.label}
                        {selectedMap.has(option.value) && <Icon name="check"></Icon>}
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
