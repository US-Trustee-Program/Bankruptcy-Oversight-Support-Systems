import Icon from '@/lib/components/uswds/Icon';
import React, { JSX } from 'react';

import './PaginationButton.scss';

export const BUTTON_BASE_CLASS = 'usa-pagination__button';

export type PaginationButtonProps = JSX.IntrinsicElements['button'] & {
  children?: React.ReactNode;
  id: string;
  isCurrent?: boolean;
  isNext?: boolean;
  isPrevious?: boolean;
};

export function PaginationButton({
  children,
  id,
  isCurrent,
  isNext,
  isPrevious,
  onClick,
}: PaginationButtonProps) {
  const classes: string[] = [];
  let ariaLabel = '';
  if (isPrevious) {
    classes.push('usa-pagination__link');
    classes.push('usa-pagination__previous-page');
    classes.push('usa-button--unstyled');
    ariaLabel = 'Previous page';
  } else if (isNext) {
    classes.push('usa-pagination__link');
    classes.push('usa-pagination__next-page');
    classes.push('usa-button--unstyled');
    ariaLabel = 'Next page';
  } else {
    classes.push(BUTTON_BASE_CLASS);
    if (isCurrent) classes.push('usa-current');
    ariaLabel = `Page ${children}`;
  }

  return (
    <button
      aria-current={isCurrent ? 'page' : undefined}
      aria-label={ariaLabel}
      className={classes.join(' ')}
      data-testid={`pagination-button-${id}`}
      onClick={onClick}
      tabIndex={0}
    >
      {isPrevious && (
        <>
          <Icon name={'navigate_before'}></Icon>
          <span className="usa-pagination__link-text">Previous</span>
        </>
      )}
      {children}
      {isNext && (
        <>
          <span className="usa-pagination__link-text">Next </span>
          <Icon name={'navigate_next'}></Icon>
        </>
      )}
    </button>
  );
}
