import { Children, createElement, isValidElement, ReactElement } from 'react';
import { UswdsButtonStyle } from './Button';

export type ButtonGroupProps = {
  id: string;
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  children: ReactElement<any> | Array<ReactElement<any>>;
  activeButtonId: string;
  onButtonClick: (id: string) => void;
  className?: string;
  ariaLabel?: string;
};

export default function ButtonGroup({
  id,
  className,
  children,
  activeButtonId,
  onButtonClick,
  ariaLabel,
}: ButtonGroupProps) {
  const buttonClick = (
    ev: React.MouseEvent<HTMLButtonElement>,
    onClick?: ((ev: React.MouseEvent<HTMLButtonElement>) => void) | undefined,
  ) => {
    if ('id' in ev.target) {
      onButtonClick((ev.target as { id: string }).id);
    }

    if (onClick) {
      onClick(ev);
    }
  };

  const renderChildren = () => {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    if (!children || (children as Array<ReactElement<any>>).length == 0) {
      return;
    }

    return Children.map(children, (child, idx) => {
      if (isValidElement(child)) {
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        const typedChild = child as React.ReactElement<any>;

        const childId = `${typedChild.props.id ?? `${id}-child-${idx}`}`;

        let childClassName: string =
          activeButtonId === childId ? UswdsButtonStyle.Default : UswdsButtonStyle.Outline;
        if (typedChild.props.className) {
          childClassName += ` ${typedChild.props.className}`;
        }

        return (
          <li key={idx} className="usa-button-group__item" role="none">
            {createElement(
              typedChild.type,
              {
                onClick: (ev: React.MouseEvent<HTMLButtonElement>) =>
                  buttonClick(
                    ev,
                    typedChild.props.onClick as
                      | ((ev: React.MouseEvent<HTMLButtonElement>) => void)
                      | undefined,
                  ),
                id: childId,
                className: childClassName,
              },
              typedChild.props.children,
            )}
          </li>
        );
      }
    });
  };

  return (
    <ul
      id={id}
      className={`usa-button-group usa-button-group--segmented ${className ? `${className}` : ''}`}
      data-testid={`button-group${id ? `-${id}` : ''}`}
      role="group"
      aria-label={ariaLabel || 'Button group'}
    >
      {renderChildren()}
    </ul>
  );
}
