import './Pill.scss';
import Icon from './uswds/Icon';
import { useEffect, useState } from 'react';

type PillProps = {
  color?: string;
  backgroundColor?: string;
  label: string;
  value: string;
  onClick: (value: string) => void;
};

export function Pill(props: PillProps) {
  const [color, setColor] = useState<string>('black');
  const [backgroundColor, setBackgroundColor] = useState<string>('#d0d0d0');

  function handlePillClick(value: string) {
    props.onClick(value);
  }

  useEffect(() => {
    if (props.color) setColor(props.color);
    if (props.backgroundColor) setBackgroundColor(props.backgroundColor);
  }, []);

  return (
    <div
      className="pill"
      style={{ backgroundColor, color }}
      onClick={() => handlePillClick(props.value)}
    >
      {props.label}
      <Icon name="close"></Icon>
    </div>
  );
}
