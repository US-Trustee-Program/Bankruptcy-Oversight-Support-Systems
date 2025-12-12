import './TextArea.scss';
import './forms.scss';
import { TextAreaRef } from '@/lib/type-declarations/input-fields';
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type JSX,
} from 'react';

type TextAreaProps = JSX.IntrinsicElements['textarea'] & {
  id: string;
  label?: string;
  ariaDescription?: string;
  value?: string;
};

function TextArea_(props: TextAreaProps, ref: React.Ref<TextAreaRef>) {
  const { id, label, ariaDescription, ...otherProps } = props;
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

  useImperativeHandle(ref, () => ({ clearValue, resetValue, setValue, getValue, disable, focus }));

  return (
    <div className={`usa-form-group textarea-container ${props.className ?? ''}`}>
      <label
        htmlFor={textAreaId}
        id={labelId}
        data-testid={labelId}
        className={'usa-label' + (props.className && ` ${props.className}-label`)}
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
          id={textAreaId}
          className={`${props.className ?? ''} usa-textarea`}
          data-testid={textAreaId}
          onChange={handleOnChange}
          disabled={inputDisabled}
          value={inputValue}
          aria-describedby={ariaDescription ? ariaDescribedBy() : undefined}
          ref={inputRef}
        ></textarea>
      </div>
    </div>
  );
}

const TextArea = forwardRef(TextArea_);
export default TextArea;
