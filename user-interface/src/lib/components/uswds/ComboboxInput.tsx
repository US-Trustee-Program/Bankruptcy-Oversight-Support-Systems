import { InputRef } from '@/lib/type-declarations/input-fields';
import { forwardRef, useImperativeHandle } from 'react';

type ComboboxInputProps = JSX.IntrinsicElements['input'] & {
  className?: string;
};

function _ComboboxInput(props: ComboboxInputProps, ref: React.Ref<InputRef>) {
  const { id, className, onChange, value, disabled, ...otherProps } = props;

  function setValue() {}
  function getValue(): string {
    return '';
  }
  function resetValue() {}
  function clearValue() {}
  function disable() {}

  useImperativeHandle(ref, () => ({ resetValue, setValue, getValue, clearValue, disable }));

  return (
    <div className={`combo-box-input-container`}>
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

const Combobox = forwardRef(_ComboboxInput);
export default Combobox;
