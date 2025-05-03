import './forms.scss';
import { PropsWithChildren, ReactElement } from 'react';

export interface RadioGroupProps extends PropsWithChildren {
  children?: Array<ReactElement> | ReactElement;
  className?: string;
  label: string;
  required?: boolean;
}

export const RadioGroup = (props: RadioGroupProps) => {
  const required = props.required ? 'true' : null;
  const classes = props.className ?? '';

  return (
    <fieldset className={`usa-fieldset radio-group ${classes}`}>
      <legend
        aria-label={`${props.label}. ${required ? 'Required' : ''}`}
        className="usa-legend"
        data-required={required}
      >
        {props.label}
      </legend>
      {props.children}
    </fieldset>
  );
};
