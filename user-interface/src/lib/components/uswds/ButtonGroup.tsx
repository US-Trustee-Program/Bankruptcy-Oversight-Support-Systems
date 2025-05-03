import { Children, createElement, isValidElement, ReactElement } from 'react';

import { UswdsButtonStyle } from './Button';

export type ButtonGroupProps = {
  activeButtonId: string;
  children: Array<ReactElement> | ReactElement;
  className?: string;
  id: string;
  onButtonClick: (id: string) => void;
};

export default function ButtonGroup({
  activeButtonId,
  children,
  className,
  id,
  onButtonClick,
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
    if (!children || (children as Array<ReactElement>).length == 0) return;

    return Children.map(children, (child, idx) => {
      if (isValidElement(child)) {
        const typedChild = child as React.ReactElement;

        const childId = `${typedChild.props.id ?? `${id}-child-${idx}`}`;

        let childClassName: string =
          activeButtonId === childId ? UswdsButtonStyle.Default : UswdsButtonStyle.Outline;
        if (typedChild.props.className) childClassName += ` ${typedChild.props.className}`;

        return (
          <li className="usa-button-group__item" key={idx}>
            {createElement(
              typedChild.type,
              {
                className: childClassName,
                id: childId,
                onClick: (ev: React.MouseEvent<HTMLButtonElement>) =>
                  buttonClick(
                    ev,
                    typedChild.props.onClick as
                      | ((ev: React.MouseEvent<HTMLButtonElement>) => void)
                      | undefined,
                  ),
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
      className={`usa-button-group usa-button-group--segmented ${className ? `${className}` : ''}`}
      data-testid={`button-group${id ? `-${id}` : ''}`}
      id={id}
    >
      {renderChildren()}
    </ul>
  );
}
