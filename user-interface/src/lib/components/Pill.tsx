import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import './Pill.scss';
import Icon from './uswds/Icon';

type PillProps = {
  id: string;
  label: string;
  ariaLabelPrefix?: string;
  value: string;
  wrapText?: boolean;
  onClick: (value: string) => void;
  onKeyDown?: (ev: React.KeyboardEvent<HTMLButtonElement>, num: number) => void;
  disabled?: boolean;
  removable?: boolean;
};

function Pill_(props: PillProps, ref: React.Ref<Partial<HTMLButtonElement>>) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const removable = props.removable !== false;

  function handleKeyDown(ev: React.KeyboardEvent<HTMLButtonElement>) {
    if (!removable) {
      if (props.onKeyDown) {
        props.onKeyDown(ev, 0);
      }
      return;
    }
    if (ev.key === 'Enter' || ev.key === ' ') {
      props.onClick(props.value);
      ev.preventDefault();
    } else if (props.onKeyDown) {
      props.onKeyDown(ev, 0);
    }
  }

  function handleClick() {
    if (!removable) return;
    props.onClick(props.value);
  }

  const wrapTextClass = props.wrapText === true ? 'wrap-text' : '';
  const removableClass = removable ? '' : 'not-removable';
  const ariaLabel = `${props.ariaLabelPrefix ? props.ariaLabelPrefix + ' - ' : ''}${props.label} selected${removable ? '. Click to deselect.' : ''}`;

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
      className={`pill usa-button--unstyled ${wrapTextClass} ${removableClass}`.trim()}
      onClick={handleClick}
      onKeyDown={(ev) => handleKeyDown(ev)}
      tabIndex={0}
      aria-label={ariaLabel}
      disabled={props.disabled}
      data-value={props.value}
      title={`${props.label}`}
      ref={buttonRef}
    >
      <div className="pill-text">{props.label}</div>
      {removable && <Icon name="close"></Icon>}
    </button>
  );
}

const Pill = forwardRef(Pill_);
export default Pill;
