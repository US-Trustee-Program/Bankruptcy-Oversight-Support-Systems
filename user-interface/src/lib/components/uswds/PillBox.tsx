import { InputRef } from '@/lib/type-declarations/input-fields';
import { forwardRef, useImperativeHandle } from 'react';
import { ComboOption } from './Combobox';
import { UswdsButtonStyle } from './Button';
import { Pill } from '../Pill';

type PillBoxProps = {
  className?: string;
  selections: ComboOption[];
  onSelectionChange: (selections: ComboOption[]) => void;
};

function _PillBox(props: PillBoxProps, ref: React.Ref<InputRef>) {
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

  useImperativeHandle(ref, () => ({ resetValue, setValue, getValue, clearValue, disable }));

  return (
    <div className={`pill-container`}>
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
