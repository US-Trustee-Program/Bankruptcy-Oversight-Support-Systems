import { forwardRef } from 'react';
import './IconInput.scss';
import Icon from './uswds/Icon';
import { InputRef } from '../type-declarations/input-fields';
import Input, { InputProps } from './uswds/Input';

export interface IconInputProps extends InputProps {
  icon: string;
  autocomplete?: 'off';
  position?: 'left' | 'right';
}

function IconInputComponent(props: IconInputProps, ref: React.Ref<InputRef>) {
  return (
    <div className="usa-form-group icon-input">
      <label className="usa-label" id={props.id + '-label'} htmlFor={props.id}>
        {props.label}
      </label>
      <Input
        className={`usa-input usa-tooltip ${props.className ?? ''}`}
        id={props.id}
        type={props.type}
        name={props.name}
        title={props.title}
        data-position="right"
        autocomplete={props.autocomplete}
        onChange={props.onChange}
        data-testid={props.id}
        disabled={props.disabled}
        min={props.min}
        max={props.max}
        pattern={props.pattern}
        inputmode={props.inputmode}
        value={props.value}
        required={props.required}
        ref={ref}
      />
      <Icon className={`usa-icon ${props.className ?? ''}`} name={props.icon}></Icon>
    </div>
  );
}
const IconInput = forwardRef(IconInputComponent);
export default IconInput;
