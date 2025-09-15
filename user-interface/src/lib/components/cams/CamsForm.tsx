import React from "react";
import Input, {InputProps} from "@/lib/components/uswds/Input";
import './CamsForm.scss'

function applyDisabledAndHidden<T>(children: React.ReactNode | React.ReactNode[], hiddenFields?: (keyof T)[], disabledFields?: (keyof T)[]): React.ReactNode[] | React.ReactNode  {
  return React.Children.toArray(children)
    .filter((child) => {
      const castChild = child as unknown as { props?: InputProps };
      if (castChild.props) {
        return !hiddenFields?.includes(castChild.props.name as keyof T);
      }
      return true;
    })
    .map((child) => {
      if (React.isValidElement(child) && (child as any)['props']['children'] ) {
        return applyDisabledAndHidden<T>((child as any)['props']['children'], hiddenFields, disabledFields);
      }
      if (React.isValidElement(child) && child.type === Input) {
        const castChild = child as unknown as { props?: InputProps };
        // Clone element with disabled property if needed
        if (disabledFields?.includes(castChild.props?.name as keyof T)) {
          return React.cloneElement(child, {
            ...castChild.props,
            disabled: true,
          } as Partial<unknown>);
        }
      }
      return child;
    })
}

type FormContainerProps<T> = {
  children: React.ReactNode | React.ReactNode[];
  hiddenFields?: (keyof T)[];
  disabledFields?: (keyof T)[];
};

export function FormContainer<T>(props: Readonly<FormContainerProps<T>>) {
  const children = applyDisabledAndHidden<T>(props.children, props.hiddenFields, props.disabledFields);
  return <div className="form-container">{children}</div>
}

export function FormColumn(props: Readonly<{ children?: React.ReactNode | React.ReactNode[]}> = {}) {
  return <div className="form-column">{props.children}</div>
}

export function FieldGroup(props: Readonly<{ children?: React.ReactNode | React.ReactNode[]}> = {}) {
  return <div className="field-group">{props.children}</div>;
}