import { InputRef } from '@/lib/type-declarations/input-fields';
import { forwardRef, useImperativeHandle } from 'react';
import { ComboOption } from './Combobox';
import { UswdsButtonStyle } from './Button';
import { Pill } from '../Pill';

type ComboboxInputProps = JSX.IntrinsicElements['input'] & {
  className?: string;
  selections: ComboOption[];
  onSelectionChange: (selections: ComboOption[]) => void;
};

function _ComboboxMultiSelectInput(props: ComboboxInputProps, ref: React.Ref<InputRef>) {
  const { id, className, onSelectionChange, onChange, value, disabled, selections, ...otherProps } =
    props;

  function setValue() {}
  function getValue(): string {
    return '';
  }
  function resetValue() {}
  function clearValue() {}
  function disable() {}

  function onPillClick(value: string) {
    console.log('clicked pill with value ' + value);
    const newSelections = selections.filter((selection: ComboOption) => {
      return selection.value !== value;
    });

    onSelectionChange(newSelections);
  }

  useImperativeHandle(ref, () => ({ resetValue, setValue, getValue, clearValue, disable }));

  return (
    <div className={`combo-box-input-container`}>
      {selections?.map((selection, idx) => (
        <Pill
          key={idx}
          color={UswdsButtonStyle.Cool}
          label={selection.label}
          value={selection.value}
          onClick={onPillClick}
        ></Pill>
      ))}
      <input
        {...otherProps}
        className={`usa-tooltip combo-box-input ${className ?? ''}`}
        onChange={onChange}
        data-testid={id}
        disabled={disabled}
        value={value}
      />
    </div>
  );
}

const ComboboxMultiSelectInput = forwardRef(_ComboboxMultiSelectInput);
export default ComboboxMultiSelectInput;
