import './forms.scss';
import { PropsWithChildren, ReactElement } from 'react';

export interface RadioGroupProps extends PropsWithChildren {
  label: string;
  required?: boolean;
  className?: string;
  children?: ReactElement | Array<ReactElement>;
}

export const RadioGroup = (props: RadioGroupProps) => {
  const required = props.required ? 'true' : null;
  const classes = props.className ?? '';

  return (
    <fieldset className={`usa-fieldset ${classes}`}>
      <legend className="usa-legend" data-required={required}>
        {props.label}
      </legend>
      {props.children}
    </fieldset>
  );
};
