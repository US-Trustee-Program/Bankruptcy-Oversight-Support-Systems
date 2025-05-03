import './TextArea.scss';
import './forms.scss';
import { TextAreaRef } from '@/lib/type-declarations/input-fields';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

export type TextAreaProps = JSX.IntrinsicElements['textarea'] & {
  ariaDescription?: string;
  id: string;
  label?: string;
  value?: string;
};

function TextAreaComponent(props: TextAreaProps, ref: React.Ref<TextAreaRef>) {
  const { ariaDescription, id, label, ...otherProps } = props;
  const labelId = `textarea-label-${id}`;
  const textAreaId = `textarea-${id}`;

  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [inputValue, setInputValue] = useState<string>(props.value || '');
  const [inputDisabled, setInputDisabled] = useState<boolean>(props.disabled ?? false);

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
  }

  function setValue(value: string) {
    setInputValue(value);
  }

  function disable(value: boolean) {
    setInputDisabled(value);
  }

  function ariaDescribedBy() {
    return `textarea-hint-${props.id}`;
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

  function focus() {
    inputRef?.current?.focus();
  }

  useImperativeHandle(ref, () => ({ clearValue, disable, focus, getValue, resetValue, setValue }));

  return (
    <div className="usa-form-group textarea-container">
      <label
        className={`usa-label ${props.className ? `${props.className}-label` : ''}`}
        data-testid={labelId}
        htmlFor={textAreaId}
        id={labelId}
      >
        {label}
        {props.required && <span className="required-form-field" />}
      </label>
      {ariaDescription && (
        <div className="usa-hint" id={ariaDescribedBy()}>
          {ariaDescription}
        </div>
      )}
      <div className="usa-textarea-group">
        <textarea
          {...otherProps}
          aria-describedby={ariaDescription ? ariaDescribedBy() : undefined}
          className={`${props.className ?? ''} usa-textarea`}
          data-testid={textAreaId}
          disabled={inputDisabled}
          id={textAreaId}
          onChange={handleOnChange}
          ref={inputRef}
          value={inputValue}
        ></textarea>
      </div>
    </div>
  );
}

const TextArea = forwardRef(TextAreaComponent);
export default TextArea;
