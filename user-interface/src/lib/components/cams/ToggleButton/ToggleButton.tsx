import { useEffect, useState } from 'react';

import Icon from '../../uswds/Icon';
import './ToggleButton.scss';

type ToggleButtonProps = {
  ariaLabel: string | ToggleLabel;
  id: string;
  isActive: boolean;
  label: string | ToggleLabel;
  onToggle: (isActive: boolean) => boolean;
  tooltipLabel: string | ToggleLabel;
};

type ToggleLabel = {
  active: string;
  inactive: string;
};

function getLabel(label: string | ToggleLabel, isActive: boolean) {
  if (isModeLabel(label)) {
    return isActive ? label.active : label.inactive;
  } else {
    return label;
  }
}

function isModeLabel(obj: unknown): obj is ToggleLabel {
  return obj !== null && typeof obj === 'object' && 'active' in obj && 'inactive' in obj;
}

function ToggleButton(props: ToggleButtonProps) {
  const [isActive, setIsActive] = useState(props.isActive);

  function handleToggle() {
    setIsActive(!isActive);
    props.onToggle(!isActive);
  }

  useEffect(() => {
    setIsActive(props.isActive);
  }, [props.isActive]);

  const ariaLabel = getLabel(props.ariaLabel, isActive);
  const label = getLabel(props.label, isActive);
  const tooltip = getLabel(props.tooltipLabel, isActive);

  return (
    <button
      aria-checked={isActive}
      aria-label={ariaLabel}
      className={`toggle-button ${isActive ? 'active' : 'inactive'} usa-tag--big usa-button--unstyled`}
      data-testid={props.id}
      id={props.id}
      onClick={handleToggle}
      role="switch"
      title={tooltip}
    >
      {label}
      <Icon name="check"></Icon>
    </button>
  );
}

export default ToggleButton;
