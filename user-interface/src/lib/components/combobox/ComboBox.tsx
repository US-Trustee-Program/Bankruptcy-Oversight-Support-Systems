import '../uswds/forms.scss';
import './ComboBox.scss';
import {
  forwardRef,
  PropsWithChildren,
  ReactElement,
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

export type ComboOption = {
  value: string;
  label: string;
  selected?: boolean;
  hidden?: boolean;
};

type InputProps = JSX.IntrinsicElements['input'] &
  JSX.IntrinsicElements['select'] &
  PropsWithChildren;

interface ComboBoxProps extends PropsWithChildren, Omit<InputProps, 'onChange'> {
  children?: ReactElement | Array<ReactElement>;
  label?: string;
  ariaLabelPrefix?: string;
  autoComplete?: 'off';
  position?: 'left' | 'right';
  value?: string;
  icon?: string;
  options: ComboOption[];
  onUpdateSelection: (options: ComboOption[]) => void;
  onUpdateFilter?: (value: string) => void;
  multiSelect: boolean;
}

function ComboBoxComponent(props: ComboBoxProps, ref: React.Ref<ComboBoxRef>) {
  const { label, value, disabled, onUpdateSelection, onUpdateFilter, multiSelect, ...otherProps } =
    props;

  // ========== STATE ==========

  const [inputDisabled, setInputDisabled] = useState<boolean>(disabled ?? false);
  const [selections, setSelections] = useState<ComboOption[]>([]);
  const [expandIcon, setExpandIcon] = useState<string>('expand_more');
  const [expanded, setExpanded] = useState<boolean>(false);
  const [expandedClass, setExpandedClass] = useState<string>('closed');
  const [dropdownLocation, setDropdownLocation] = useState<{ bottom: number } | null>(null);
  const [currentSelection, setCurrentSelection] = useState<number>(0);
  const [filteredOptions, setFilteredOptions] = useState<ComboOption[]>(props.options);

  // ========== REFS ==========

  const comboBoxRef = useRef(null);
  const pillBoxRef = useRef(null);
  const filterRef = useRef<HTMLInputElement>(null);

  useOutsideClick([comboBoxRef], isOutsideClick);

  // ========== MISC FUNCTIONS ==========

  function clearAll() {
    setSelections([]);
  }

  function clearFilter() {
    if (filterRef.current) filterRef.current.value = '';
    filterDropdown('');
  }

  function closeDropdown(shouldFocusOnInput: boolean = true) {
    setExpandIcon('expand_more');
    setExpanded(false);
    setExpandedClass('closed');
    setCurrentSelection(0);
    clearFilter();
    if (shouldFocusOnInput) filterRef.current?.focus();
  }

  function openDropdown() {
    setExpandIcon('expand_less');
    setExpanded(true);
    setExpandedClass('expanded');
  }

  function disable(value: boolean) {
    setInputDisabled(value);
  }

  function elementIsVerticallyScrollable(parent: Element, child: Element) {
    const parentHeight = parent.getBoundingClientRect().height ?? 0;
    const childHeight = child.getBoundingClientRect().height ?? 0;
    return childHeight > parentHeight;
  }

  function filterDropdown(value: string) {
    const newOptions = [...filteredOptions];
    newOptions?.forEach((option) => {
      if (!value || option.label.includes(value)) {
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
    return selections ?? [];
  }

  function isOutsideClick(ev: MouseEvent) {
    if (comboBoxRef.current) {
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
        if (item.value === option.value) {
          result = true;
          break;
        }
      }
    }
    return result;
  }

  function setListItemClass(index: number, option: ComboOption) {
    const classNames = [];
    if (option.hidden) {
      classNames.push('hidden');
    } else {
      if (isSelected(option)) classNames.push('selected');
      if (currentSelection === index) classNames.push('highlighted');
    }
    return classNames.join(' ');
  }

  // ========== HANDLERS ==========

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
    if (onUpdateSelection && newSelections) {
      onUpdateSelection(newSelections);
    }
  }

  function handleInputFilter(ev: React.ChangeEvent<HTMLInputElement>) {
    openDropdown();
    filterDropdown(ev.target.value);
    if (onUpdateFilter) onUpdateFilter(ev.target.value);
  }

  function handleKeyDown(ev: React.KeyboardEvent, index: number, _option?: ComboOption) {
    const list = document.querySelector(`#${props.id} .item-list-container ul`);
    const input = filterRef.current;

    switch (ev.key) {
      case 'Tab':
        if (expanded && (ev.target as HTMLInputElement).classList.contains('combo-box-input')) {
          if (list?.children.length === filteredOptions.length) {
            closeDropdown();
          } else {
            if (list && index < filteredOptions.length) {
              while (
                list.children[index].classList.contains('hidden') &&
                index < filteredOptions.length
              ) {
                ++index;
              }
            }
            setCurrentSelection(index + 1);
          }
        } else {
          closeDropdown();
        }
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
          setCurrentSelection(index + 1);
          const button = list?.children[index].querySelector('button');
          if (list && button) focusAndHandleScroll(ev, button);
        } else {
          setCurrentSelection(0);
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
          setCurrentSelection(index - 1);
          const button = list?.children[index - 2].querySelector('button');
          if (list && button) focusAndHandleScroll(ev, button);
        } else if (index === 1) {
          setCurrentSelection(0);
          if (input) focusAndHandleScroll(ev, input);
        } else if (index === 0) {
          setCurrentSelection(filteredOptions.length);
          const button = list?.children[list.children.length - 1].querySelector('button');
          if (list && button) focusAndHandleScroll(ev, button);
        }
        break;
    }
  }

  function handlePillSelection(selections: ComboOption[]) {
    setSelections(selections);
    if (onUpdateSelection && selections) {
      onUpdateSelection(selections);
    }
  }

  function handleToggleDropdown(_ev: React.MouseEvent<HTMLButtonElement>) {
    const screenBottom = window.scrollY + window.innerHeight;
    const inputContainer = document.querySelector(`#${props.id} .input-container`);
    const topYPos = inputContainer?.getBoundingClientRect().top;
    const bottomYPos = inputContainer?.getBoundingClientRect().bottom;

    if (bottomYPos && filteredOptions.length * 43 > screenBottom - bottomYPos) {
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
    setFilteredOptions(props.options);
  }, [props.options]);

  useImperativeHandle(ref, () => ({ getValue, disable }));

  // ========== JSX ==========

  return (
    <div id={props.id} className="usa-form-group combo-box-form-group" ref={comboBoxRef}>
      <div className={`chapter-label ${multiSelect ? 'multi-select' : ''}`}>
        <label className="usa-label" id={props.id + '-label'}>
          {label}
        </label>
      </div>
      {multiSelect && (
        <div className="pills-and-clear-all">
          <PillBox
            id={`${props.id}-pill-box`}
            ariaLabelPrefix={props.ariaLabelPrefix}
            selections={selections ?? []}
            onSelectionChange={handlePillSelection}
            disabled={inputDisabled}
            ref={pillBoxRef}
          ></PillBox>
          {selections && selections.length > 0 && (
            <Button
              uswdsStyle={UswdsButtonStyle.Unstyled}
              onClick={clearAll}
              aria-label="clear all selections"
              disabled={inputDisabled}
            >
              clear
            </Button>
          )}
        </div>
      )}
      <div className="usa-combo-box">
        <div className="input-container usa-input">
          <div className="combo-box-input-container">
            <input
              {...otherProps}
              id={`${props.id}-combo-box-input`}
              className={`usa-tooltip combo-box-input`}
              onChange={handleInputFilter}
              onKeyDown={(ev) => handleKeyDown(ev, 0)}
              onClick={openDropdown}
              value={value}
              disabled={inputDisabled}
              aria-label={`${props.ariaLabelPrefix}: Enter text to filter options. Use up and down arrows to open dropdown list.`}
              ref={filterRef}
            />
          </div>
          <Button
            id={`${props.id}-expand`}
            className="expand-button"
            uswdsStyle={UswdsButtonStyle.Unstyled}
            onClick={handleToggleDropdown}
            onKeyDown={(ev) => handleKeyDown(ev, 0)}
            disabled={inputDisabled}
            tabIndex={-1}
          >
            <Icon name={expandIcon}></Icon>
          </Button>
        </div>
        {!inputDisabled && (
          <div
            className={`item-list-container ${expandedClass}`}
            id={`${props.id}-item-list`}
            aria-hidden={`${expanded}`}
            tabIndex={-1}
            style={dropdownLocation ?? undefined}
          >
            <ul>
              {filteredOptions.map((option, idx) => (
                <li className={setListItemClass(idx, option)} key={`${props.id}-${idx}`}>
                  <button
                    className="usa-button--unstyled"
                    data-value={option.value}
                    data-testid={`combo-box-option-${option.label}`}
                    onClick={() => handleDropdownItemSelection(option)}
                    onKeyDown={(ev) => handleKeyDown(ev, idx + 1, option)}
                    tabIndex={expanded ? 0 : -1}
                    aria-label={`multi-select option: ${props.ariaLabelPrefix} ${option.label} ${selections.includes(option)! ? 'selected' : 'unselected'}`}
                  >
                    {
                      <>
                        {option.label}
                        {selections.includes(option) && <Icon name="check"></Icon>}
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
