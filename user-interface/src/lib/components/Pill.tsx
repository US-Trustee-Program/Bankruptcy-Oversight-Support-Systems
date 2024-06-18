import './Pill.scss';
import Icon from './uswds/Icon';
import { useEffect, useState } from 'react';

const defaultColor = 'black';
const defaultBackgroundColor = '#d0d0d0';

type PillProps = {
  color?: string;
  backgroundColor?: string;
  label: string;
  ariaLabelPrefix?: string;
  value: string;
  onClick: (value: string) => void;
};

export function Pill(props: PillProps) {
  const [color, setColor] = useState<string>(defaultColor);
  const [backgroundColor, setBackgroundColor] = useState<string>(defaultBackgroundColor);

  function handlePillClick(value: string) {
    props.onClick(value);
  }

  function handleKeyDown(ev: React.KeyboardEvent) {
    if (ev.key === 'Enter' || ev.key === ' ') {
      handlePillClick(props.value);
      ev.preventDefault();
    }
  }

  useEffect(() => {
    setColor(props.color ?? defaultColor);
    setBackgroundColor(props.backgroundColor ?? defaultBackgroundColor);
  }, []);

  return (
    <button
      className="pill usa-button--unstyled"
      style={{ backgroundColor, color }}
      onClick={() => handlePillClick(props.value)}
      onKeyDown={(ev) => handleKeyDown(ev)}
      tabIndex={0}
      aria-label={`${props.ariaLabelPrefix} - ${props.label} is currently selected.`}
    >
      {props.label}
      <Icon name="close"></Icon>
    </button>
  );
}
