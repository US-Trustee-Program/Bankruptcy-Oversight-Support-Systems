import './forms.scss';
import './RadioGroup.scss';
import { PropsWithChildren, ReactElement, useRef } from 'react';

export interface RadioGroupProps extends PropsWithChildren {
  label: string;
  required?: boolean;
  className?: string;
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  children?: ReactElement<any> | Array<ReactElement<any>>;
}

function getNextIndex(currentIndex: number, key: string, length: number): number {
  if (currentIndex === -1) {
    return 0;
  }

  const isNextKey = key === 'ArrowDown' || key === 'ArrowRight';
  const delta = isNextKey ? 1 : -1;

  return (currentIndex + delta + length) % length;
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

    const allRadios = Array.from(
      fieldsetRef.current!.querySelectorAll<HTMLElement>('[role="radio"]'),
    );
    const radios = allRadios.filter((radio) => {
      const element = radio as HTMLButtonElement | HTMLInputElement;
      const isDisabledAttr = element.hasAttribute('disabled') || element.disabled;
      const isAriaDisabled = element.getAttribute('aria-disabled') === 'true';
      return !isDisabledAttr && !isAriaDisabled;
    });

    if (radios.length === 0) return;

    const currentIndex = radios.indexOf(ev.target as HTMLElement);
    const nextIndex = getNextIndex(currentIndex, ev.key, radios.length);

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
