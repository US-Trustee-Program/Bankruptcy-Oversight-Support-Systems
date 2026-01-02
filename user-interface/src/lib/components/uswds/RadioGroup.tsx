import './forms.scss';
import { PropsWithChildren, ReactElement, useRef } from 'react';

export interface RadioGroupProps extends PropsWithChildren {
  label: string;
  required?: boolean;
  className?: string;
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  children?: ReactElement<any> | Array<ReactElement<any>>;
}

export const RadioGroup = (props: RadioGroupProps) => {
  const required = props.required ? 'true' : null;
  const classes = props.className ?? '';
  const fieldsetRef = useRef<HTMLFieldSetElement>(null);

  const handleKeyDown = (ev: React.KeyboardEvent<HTMLFieldSetElement>) => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(ev.key)) {
      return;
    }

    ev.preventDefault();

    if (!fieldsetRef.current) return;

    // Find all radio buttons in the group
    const radios = Array.from(fieldsetRef.current.querySelectorAll<HTMLElement>('[role="radio"]'));

    if (radios.length === 0) return;

    const currentIndex = radios.findIndex((radio) => radio === document.activeElement);

    let nextIndex: number;
    if (currentIndex === -1) {
      // No radio focused, focus the first one
      nextIndex = 0;
    } else if (ev.key === 'ArrowDown' || ev.key === 'ArrowRight') {
      // Move to next radio (wrap around)
      nextIndex = (currentIndex + 1) % radios.length;
    } else {
      // ArrowUp or ArrowLeft - move to previous radio (wrap around)
      nextIndex = (currentIndex - 1 + radios.length) % radios.length;
    }

    const targetRadio = radios[nextIndex];
    targetRadio.focus();
    targetRadio.click();
  };

  return (
    <fieldset
      className={`usa-fieldset radio-group ${classes}`}
      role="radiogroup"
      aria-required={props.required}
      onKeyDown={handleKeyDown}
      ref={fieldsetRef}
    >
      <legend
        className="usa-legend"
        data-required={required}
        aria-label={`${props.label}. ${required ? 'Required' : ''}`}
      >
        {props.label}
      </legend>
      {props.children}
    </fieldset>
  );
};
