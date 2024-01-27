import { Children, createElement, ReactElement, isValidElement, useState } from 'react';
import { UswdsButtonStyle } from './Button';

export interface ButtonProps {
  id: string;
  children: ReactElement | Array<ReactElement>;
  className?: string;
}

export default function ButtonGroup({ id, className, children }: ButtonProps) {
  const [activeButtonId, setActiveButtonId] = useState<string>('');

  const buttonClick = (
    ev: React.MouseEvent<HTMLButtonElement>,
    onClick?: ((ev: React.MouseEvent<HTMLButtonElement>) => void) | undefined,
  ) => {
    if ('id' in ev.target) {
      const id = (ev.target as { id: string }).id;
      /*
    if (Object.prototype.hasOwnProperty.call(ev.target, 'id')) {
      const id = (ev.target as HTMLButtonElement).id;
      */
      setActiveButtonId(id);
    }

    if (onClick) {
      onClick(ev);
    }
  };

  const renderChildren = () => {
    if (!children) return;

    return Children.map(children, (child, idx) => {
      if (isValidElement(child)) {
        const typedChild = child as React.ReactElement;

        const childId = `${id}-${typedChild.props.id ?? idx}`;

        let childClassName: string =
          activeButtonId === childId ? UswdsButtonStyle.Default : UswdsButtonStyle.Outline;
        if (typedChild.props.className) childClassName += ` ${typedChild.props.className}`;

        return (
          <li className="usa-button-group__item">
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
    >
      {renderChildren()}
    </ul>
  );
}
