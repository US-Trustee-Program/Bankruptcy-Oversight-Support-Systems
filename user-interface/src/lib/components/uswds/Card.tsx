import React from 'react';
import { JSX, ReactNode } from 'react';

export type HeadingLevel = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

export type CardProps = JSX.IntrinsicElements['div'] & {
  children: ReactNode;
  headingLevel?: HeadingLevel;
};

export const CardHeading = ({ children }: { children: ReactNode }) => <>{children}</>;
export const CardBody = ({ children }: { children: ReactNode }) => <>{children}</>;
export const CardFooter = ({ children }: { children: ReactNode }) => <>{children}</>;

export const Card = ({ children, headingLevel = 'h4', ...props }: CardProps) => {
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

  const HeadingTag = headingLevel;

  return (
    <div className="usa-card" {...props}>
      <div className="usa-card__container">
        {heading && (
          <div className="usa-card__header">
            <HeadingTag className="usa-card__heading">{heading}</HeadingTag>
          </div>
        )}
        {body && <div className="usa-card__body">{body}</div>}
        {footer && <div className="usa-card__footer">{footer}</div>}
      </div>
    </div>
  );
};
