import { forwardRef, useImperativeHandle, useRef } from 'react';

import './Pill.scss';
import Icon from './uswds/Icon';

const defaultColor = 'black';
const defaultBackgroundColor = '#d0d0d0';

type PillProps = {
  ariaLabelPrefix?: string;
  backgroundColor?: string;
  className?: string;
  color?: string;
  disabled?: boolean;
  id: string;
  label: string;
  onClick: (value: string) => void;
  onKeyDown?: (ev: React.KeyboardEvent<HTMLButtonElement>, num: number) => void;
  value: string;
  wrapText?: boolean;
};

function _Pill(props: PillProps, ref: React.Ref<Partial<HTMLButtonElement>>) {
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
      aria-label={`${props.ariaLabelPrefix ? props.ariaLabelPrefix + ' - ' : ''}${props.label} selected. Click to deselect.`}
      className={`pill usa-button--unstyled ${wrapTextClass}`}
      data-testid={`pill-${props.id}`}
      data-value={props.value}
      disabled={props.disabled}
      id={props.id}
      onClick={() => props.onClick(props.value)}
      onKeyDown={(ev) => handleKeyDown(ev)}
      ref={buttonRef}
      style={{ backgroundColor, color }}
      tabIndex={0}
      title={`${props.label}`}
    >
      <div className="pill-text">{props.label}</div>
      <Icon name="close"></Icon>
    </button>
  );
}

export const Pill = forwardRef(_Pill);
