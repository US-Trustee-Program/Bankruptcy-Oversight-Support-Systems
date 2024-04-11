import './forms.scss';
import { PropsWithChildren, ReactElement } from 'react';

export interface LegendProps extends PropsWithChildren {
  label: string;
  required?: boolean;
  htmlFor?: string;
  className?: string;
  children: ReactElement | Array<ReactElement>;
}

export const RadioGroup = (props: LegendProps) => {
  return (
    <fieldset className={`usa-fieldset uswds-form ${props.className ?? ''}`}>
      <legend className="usa-legend" data-required={props.required ? 'true' : null}>
        {props.label}
      </legend>
      {props.children}
    </fieldset>
  );
};
