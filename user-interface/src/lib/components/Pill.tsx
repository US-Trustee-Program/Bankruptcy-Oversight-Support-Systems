import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import './Pill.scss';
import Icon from './uswds/Icon';

const defaultColor = 'black';
const defaultBackgroundColor = '#d0d0d0';

type PillProps = {
  id: string;
  color?: string;
  backgroundColor?: string;
  label: string;
  ariaLabelPrefix?: string;
  value: string;
  wrapText?: boolean;
  onClick: (value: string) => void;
  onKeyDown?: (ev: React.KeyboardEvent<HTMLButtonElement>, num: number) => void;
  disabled?: boolean;
};

function Pill_(props: PillProps, ref: React.Ref<Partial<HTMLButtonElement>>) {
  const color = props.color ?? defaultColor;
  const backgroundColor = props.backgroundColor ?? defaultBackgroundColor;
  const buttonRef = useRef<HTMLButtonElement>(null);

  function handleKeyDown(ev: React.KeyboardEvent<HTMLButtonElement>) {
    if (ev.key === 'Enter' || ev.key === ' ') {
      props.onClick(props.value);
      ev.preventDefault();
    } else if (props.onKeyDown) {
      props.onKeyDown(ev, 0);
    }
  }

  const wrapTextClass = props.wrapText === true ? 'wrap-text' : '';

  const focusButton = () => {
    buttonRef.current?.focus();
  };

  useImperativeHandle(ref, () => {
    return {
      focus: focusButton,
    };
  });

  return (
    <button
      id={props.id}
      data-testid={`pill-${props.id}`}
      className={`pill usa-button--unstyled ${wrapTextClass}`}
      style={{ backgroundColor, color }}
      onClick={() => props.onClick(props.value)}
      onKeyDown={(ev) => handleKeyDown(ev)}
      tabIndex={0}
      aria-label={`${props.ariaLabelPrefix ? props.ariaLabelPrefix + ' - ' : ''}${props.label} selected. Click to deselect.`}
      disabled={props.disabled}
      data-value={props.value}
      title={`${props.label}`}
      ref={buttonRef}
    >
      <div className="pill-text">{props.label}</div>
      <Icon name="close"></Icon>
    </button>
  );
}

const Pill = forwardRef(Pill_);
export default Pill;
