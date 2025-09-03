import React from 'react';
import { JSX, ReactNode } from 'react';

export type CardProps = JSX.IntrinsicElements['div'] & {
  children: ReactNode;
};

export const CardHeading = ({ children }: { children: ReactNode }) => <>{children}</>;
export const CardBody = ({ children }: { children: ReactNode }) => <>{children}</>;
export const CardFooter = ({ children }: { children: ReactNode }) => <>{children}</>;

export const Card = ({ children }: CardProps) => {
  let heading: ReactNode = null;
  let body: ReactNode = null;
  let footer: ReactNode = null;

  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) {
      return;
    } else if (child.type === CardHeading) {
      heading = child;
    } else if (child.type === CardBody) {
      body = child;
    } else if (child.type === CardFooter) {
      footer = child;
    }
  });

  return (
    <div className="usa-card">
      <div className="usa-card__container">
        {heading && (
          <div className="usa-card__header">
            <h4 className="usa-card__heading">{heading}</h4>
          </div>
        )}
        {body && <div className="usa-card__body">{body}</div>}
        {footer && <div className="usa-card__footer">{footer}</div>}
      </div>
    </div>
  );
};
