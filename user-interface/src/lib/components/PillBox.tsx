import { InputRef } from '@/lib/type-declarations/input-fields';
import { forwardRef, useImperativeHandle } from 'react';
import { ComboOption } from './combobox/ComboBox';
import { Pill } from './Pill';
import { UswdsButtonStyle } from './uswds/Button';

type PillBoxRef = InputRef & {
  contains: (el: HTMLElement) => boolean;
};

type PillBoxProps = {
  id: string;
  disabled?: boolean;
  ariaLabelPrefix?: string;
  className?: string;
  selections: ComboOption[];
  onSelectionChange: (selections: ComboOption[]) => void;
};

function _PillBox(props: PillBoxProps, ref: React.Ref<PillBoxRef>) {
  const { onSelectionChange, selections, ariaLabelPrefix, disabled } = props;

  function setValue() {}
  function getValue(): string {
    return '';
  }
  function resetValue() {}
  function clearValue() {}
  function disable() {}

  function onPillClick(value: string) {
    const newSelections = [];
    let removedIndex = 0;
    for (let i = 0; i < selections.length; i++) {
      if (selections[i].value !== value) {
        newSelections.push(selections[i]);
      } else {
        removedIndex = i;
      }
    }

    if (newSelections.length > 0 && removedIndex > newSelections.length - 1) {
      const pill = document.querySelector(`#${props.id} button.pill:nth-child(${removedIndex})`);
      if (pill) (pill as HTMLButtonElement).focus();
    } else {
      const pill = document.querySelector(
        `#${props.id} button.pill:nth-child(${removedIndex + 1})`,
      );
      if (pill) (pill as HTMLButtonElement).focus();
    }

    onSelectionChange(newSelections);
  }

  function contains(el: HTMLElement) {
    let isContained = false;
    const pillBox = document.querySelector(`#${props.id}.pill-container`);
    if (pillBox?.contains(el)) isContained = true;

    return isContained;
  }

  useImperativeHandle(ref, () => ({
    resetValue,
    setValue,
    getValue,
    clearValue,
    disable,
    contains,
  }));

  return (
    <div id={props.id} className={`pill-container`}>
      {selections?.map((selection, idx) => (
        <Pill
          key={idx}
          color={UswdsButtonStyle.Cool}
          label={selection.label}
          ariaLabelPrefix={ariaLabelPrefix}
          value={selection.value}
          onClick={onPillClick}
          disabled={disabled}
        ></Pill>
      ))}
    </div>
  );
}

const PillBox = forwardRef(_PillBox);
export default PillBox;
