import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { ComboOption } from './combobox/ComboBox';
import { Pill } from './Pill';

export type PillBoxRef = {
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
  const { onSelectionChange, ariaLabelPrefix, disabled } = props;

  const [selections, setSelections] = useState<ComboOption[]>([]);

  function onPillClick(value: string) {
    const newSelections: ComboOption[] = [];
    let removedIndex = 0;
    selections.forEach((selection, index) => {
      if (selection.value !== value) {
        newSelections.push(selection);
      } else {
        removedIndex = index;
      }
    });

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
    setSelections(newSelections);
  }

  function contains(el: HTMLElement) {
    let isContained = false;
    const pillBox = document.querySelector(`#${props.id}.pill-container`);
    if (pillBox?.contains(el)) isContained = true;

    return isContained;
  }

  useImperativeHandle(ref, () => ({
    contains,
  }));

  useEffect(() => {
    setSelections(props.selections);
  }, [props.selections]);

  return (
    <div id={props.id} className={`pill-container`}>
      {selections?.map((selection, idx) => (
        <Pill
          id={`pill-${props.id}-${idx}`}
          key={idx}
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
