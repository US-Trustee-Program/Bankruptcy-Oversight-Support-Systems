import React, {
  PropsWithChildren,
  ChangeEventHandler,
  forwardRef,
  useImperativeHandle,
  useState,
  ReactElement,
  ForwardRefRenderFunction,
} from 'react';
import { InputRef } from '../../type-declarations/input-fields';

// interface SelectOptionProps
//   extends React.DetailedHTMLProps<
//     React.OptionHTMLAttributes<HTMLOptionElement>,
//     HTMLOptionElement
//   > {
//   value: string;
// }

export interface SelectProps extends PropsWithChildren {
  children: Array<ReactElement>;
  id: string;
  className?: string;
  name?: string;
  title?: string;
  onChange?: ChangeEventHandler<HTMLSelectElement>;
  disabled?: boolean;
  ariaLabel?: string;
  value?: string;
}

const BLANK = '';

const SelectComponent: ForwardRefRenderFunction<InputRef, SelectProps> = (
  { children, ...props },
  ref,
) => {
  const [selectedValue, setSelectedValue] = useState<string>(props.value || BLANK);

  function clearValue() {
    setSelectedValue(BLANK);
    //props.onChange()
  }

  function handleOnChange(ev: React.ChangeEvent<HTMLSelectElement>) {
    setSelectedValue(ev.target.value);
    if (props.onChange) {
      props.onChange(ev);
    }
  }

  // const renderChildren = () => {
  //   return Children.map(children, (child) => {
  //     if (React.isValidElement(child) && child.type === 'option') {
  //       const optionProps = child.props as SelectOptionProps;
  //       return cloneElement(child as React.ReactElement<SelectOptionProps>, {
  //         ...optionProps,
  //       });
  //     }
  //     return child;
  //   });
  // };

  useImperativeHandle(ref, () => ({ clearValue }));

  return (
    <div className="ustp-icon-input">
      <select
        className={`usa-select usa-tooltip ${props.className}`}
        id={props.id}
        name={props.name}
        title={props.title}
        onChange={handleOnChange}
        data-testid={props.id}
        disabled={props.disabled}
        aria-label={props.ariaLabel}
        value={selectedValue}
      >
        <option value={BLANK}></option>
        {children}
      </select>
    </div>
  );
};
const Select = forwardRef(SelectComponent);
export default Select;
