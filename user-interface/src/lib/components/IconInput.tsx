import { ChangeEventHandler } from 'react';
import './IconInput.scss';
import Icon from './uswds/Icon';

export interface IconInputProps {
  id: string;
  className?: string;
  type?: string;
  name?: string;
  title?: string;
  icon: string;
  autocomplete?: 'off';
  position?: 'left' | 'right';
  onChange?: ChangeEventHandler<HTMLInputElement>;
  disabled?: boolean;
  min?: number;
  max?: number;
  pattern?: string;
  inputmode?: 'search' | 'text' | 'email' | 'tel' | 'url' | 'none' | 'numeric' | 'decimal';
}

export default function IconInput(props: IconInputProps) {
  //condition for check for title to style tooltip
  return (
    <div className="ustp-icon-input">
      <input
        className={`usa-input usa-tooltip ${props.className}`}
        id={props.id}
        type={props.type}
        name={props.name}
        title={props.title}
        data-position="right"
        autoComplete={props.autocomplete}
        onChange={props.onChange}
        data-testid={props.id}
        disabled={props.disabled}
        min={props.min}
        max={props.max}
        pattern={props.pattern}
        inputMode={props.inputmode}
      />
      <Icon className={`usa-icon ${props.className}`} name={props.icon}></Icon>
    </div>
  );
}
