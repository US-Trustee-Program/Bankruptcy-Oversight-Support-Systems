import { useState } from 'react';
import Icon from '../../uswds/Icon';
import './ToggleButton.scss';

type ModeLabel = {
  active: string;
  inactive: string;
};

function isModeLabel(obj: unknown): obj is ModeLabel {
  return obj !== null && typeof obj === 'object' && 'active' in obj && 'inactive' in obj;
}

function getLabel(label: string | ModeLabel, isActive: boolean) {
  if (isModeLabel(label)) {
    return isActive ? label.active : label.inactive;
  } else {
    return label;
  }
}

type ToggleButtonProps = {
  id: string;
  label: string | ModeLabel;
  ariaLabel: string | ModeLabel;
  isActive: boolean;
  onToggle: () => void;
};

function ToggleButton(props: ToggleButtonProps) {
  const [isActive, setIsActive] = useState(props.isActive);

  function handleToggle() {
    setIsActive(!isActive);
    if (props.onToggle) {
      props.onToggle();
    }
  }

  const arialLabel = getLabel(props.ariaLabel, isActive);
  const label = getLabel(props.label, isActive);

  return (
    <div className="toggle-button">
      <button
        id={props.id}
        data-testid={props.id}
        role="switch"
        className={`${isActive ? 'active' : 'inactive'} usa-tag--big usa-button--unstyled`}
        aria-label={arialLabel}
        aria-checked={isActive}
        onClick={handleToggle}
      >
        {label}
        <Icon name="check"></Icon>
      </button>
    </div>
  );
}

export default ToggleButton;
