import { useEffect, useState } from 'react';
import Button, { UswdsButtonStyle } from './uswds/Button';
import Icon from './uswds/Icon';

type PillProps = {
  color?: UswdsButtonStyle;
  label: string;
  value: string;
  onClick: (value: string) => void;
};

export function Pill(props: PillProps) {
  const [style, setStyle] = useState<UswdsButtonStyle>(UswdsButtonStyle.Default);

  function handleButtonClick(value: string) {
    props.onClick(value);
  }

  useEffect(() => {
    if (props.color) {
      setStyle(props.color);
    }
  }, []);

  return (
    <div className={`pill`}>
      <Button uswdsStyle={style} onClick={() => handleButtonClick(props.value)}>
        {props.label}
        <Icon name="close"></Icon>
      </Button>
    </div>
  );
}
