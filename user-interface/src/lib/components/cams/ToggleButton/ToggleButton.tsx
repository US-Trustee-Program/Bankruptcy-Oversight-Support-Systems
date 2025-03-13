import { useEffect, useState } from 'react';
import Icon from '../../uswds/Icon';
import './ToggleButton.scss';

type ToggleLabel = {
  active: string;
  inactive: string;
};

function isModeLabel(obj: unknown): obj is ToggleLabel {
  return obj !== null && typeof obj === 'object' && 'active' in obj && 'inactive' in obj;
}

function getLabel(label: string | ToggleLabel, isActive: boolean) {
  if (isModeLabel(label)) {
    return isActive ? label.active : label.inactive;
  } else {
    return label;
  }
}

type ToggleButtonProps = {
  id: string;
  label: string | ToggleLabel;
  ariaLabel: string | ToggleLabel;
  tooltipLabel: string | ToggleLabel;
  isActive: boolean;
  onToggle: (isActive: boolean) => boolean;
};

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
      id={props.id}
      data-testid={props.id}
      role="switch"
      className={`toggle-button ${isActive ? 'active' : 'inactive'} usa-tag--big usa-button--unstyled`}
      aria-label={ariaLabel}
      aria-checked={isActive}
      onClick={handleToggle}
      title={tooltip}
    >
      {label}
      <Icon name="check"></Icon>
    </button>
  );
}

export default ToggleButton;
