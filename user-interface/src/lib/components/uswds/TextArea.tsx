import './TextArea.scss';
import './forms.scss';
import { TextAreaRef } from '@/lib/type-declarations/input-fields';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

export type TextAreaProps = JSX.IntrinsicElements['textarea'] & {
  id: string;
  label?: string;
  ariaDescription?: string;
  value?: string;
};

function TextAreaComponent(props: TextAreaProps, ref: React.Ref<TextAreaRef>) {
  const { id, label, ariaDescription, ...otherProps } = props;
  const labelId = `${id}-textarea-label`;
  const textAreaId = `${id}-textarea`;

  const [inputValue, setInputValue] = useState<string>(props.value || '');
  const [inputDisabled, setInputDisabled] = useState<boolean>(props.disabled ?? false);

  const inputRef = useRef(null);

  function emitChange(value: string) {
    if (props.onChange) {
      const ev = { target: { value } } as React.ChangeEvent<HTMLTextAreaElement>;
      props.onChange(ev);
    }
  }

  function getValue() {
    return inputValue;
  }

  function resetValue() {
    setInputValue(props.value || '');
  }

  function clearValue() {
    setInputValue('');
    emitChange('');
    if (inputRef.current) (inputRef.current as HTMLTextAreaElement).focus();
  }

  function setValue(value: string) {
    setInputValue(value);
  }

  function disable(value: boolean) {
    setInputDisabled(value);
  }

  function ariaDescribedBy() {
    return `textarea-hint-${props.id ?? Math.random().toString(36).slice(2, 7)}`;
  }

  function handleOnChange(ev: React.ChangeEvent<HTMLTextAreaElement>): void {
    setInputValue(ev.target.value);
    if (props.onChange) {
      props.onChange(ev);
    }
  }

  useEffect(() => {
    setInputValue(props.value || '');
  }, [props.value]);

  useImperativeHandle(ref, () => ({ clearValue, resetValue, setValue, getValue, disable }));

  return (
    <div className="usa-form-group textarea-container">
      <label
        htmlFor={textAreaId}
        id={labelId}
        data-testid={labelId}
        className={`usa-label ${props.className ? `${props.className}-label` : ''}`}
      >
        {label}
      </label>
      {ariaDescription && (
        <div className="usa-hint" id={ariaDescribedBy()}>
          {ariaDescription}
        </div>
      )}
      <textarea
        {...otherProps}
        id={textAreaId}
        className={`${props.className ?? ''} usa-textarea`}
        data-testid={textAreaId}
        onChange={handleOnChange}
        value={inputValue}
        disabled={inputDisabled}
      ></textarea>
    </div>
  );
}

const TextArea = forwardRef(TextAreaComponent);
export default TextArea;
