import { InputRef } from '@/lib/type-declarations/input-fields';
import { forwardRef, useImperativeHandle } from 'react';
import { ComboOption } from './uswds/Combobox';
import { Pill } from './Pill';
import { UswdsButtonStyle } from './uswds/Button';

type PillBoxRef = InputRef & {
  contains: (el: HTMLElement) => boolean;
};

type PillBoxProps = {
  id: string;
  className?: string;
  selections: ComboOption[];
  onSelectionChange: (selections: ComboOption[]) => void;
};

function _PillBox(props: PillBoxProps, ref: React.Ref<PillBoxRef>) {
  const { onSelectionChange, selections } = props;

  function setValue() {}
  function getValue(): string {
    return '';
  }
  function resetValue() {}
  function clearValue() {}
  function disable() {}

  function onPillClick(value: string) {
    const newSelections = selections.filter((selection: ComboOption) => {
      return selection.value !== value;
    });

    onSelectionChange(newSelections);
  }

  function contains(el: HTMLElement) {
    let isContained = false;
    const pillBox = document.querySelector(`#${props.id}.pill-container`);
    if (pillBox?.contains(el)) isContained = true;
    /*
    const pills = document.querySelectorAll(`#${props.id}.pill-container .pill`);
    pills.forEach((pill) => {
      if (pill.contains(el)) isContained = true;
    });
    */

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
          value={selection.value}
          onClick={onPillClick}
        ></Pill>
      ))}
    </div>
  );
}

const PillBox = forwardRef(_PillBox);
export default PillBox;
