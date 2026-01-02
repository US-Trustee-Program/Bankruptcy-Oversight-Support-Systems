import './Card.scss';
import { HtmlHeading } from '@/lib/utils/html-semantics';
import React from 'react';
import { JSX, ReactNode } from 'react';

type CardProps = JSX.IntrinsicElements['section'] & {
  children: ReactNode;
  headingLevel?: HtmlHeading;
};

export const CardHeading = ({ children }: { children: ReactNode }) => <>{children}</>;
export const CardBody = ({ children }: { children: ReactNode }) => <>{children}</>;
export const CardFooter = ({ children }: { children: ReactNode }) => <>{children}</>;

export const Card = ({ children, headingLevel = 'h4', ...props }: CardProps) => {
  let heading: ReactNode = null;
  let body: ReactNode = null;
  let footer: ReactNode = null;

  const baseId = props.id || `card-${React.useId()}`;
  const headingId = `${baseId}-heading`;
  const HeadingTag = headingLevel;

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

  const sectionAriaProps = heading ? { 'aria-labelledby': headingId } : {};

  return (
    <section className="usa-card" {...props} {...sectionAriaProps}>
      <div className="usa-card__container">
        {heading && (
          <header className="usa-card__header">
            <HeadingTag className="usa-card__heading" id={headingId}>
              {heading}
            </HeadingTag>
          </header>
        )}
        {body && <div className="usa-card__body">{body}</div>}
        {footer && <footer className="usa-card__footer">{footer}</footer>}
      </div>
    </section>
  );
};
