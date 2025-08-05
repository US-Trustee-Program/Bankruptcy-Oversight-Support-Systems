import { JSX } from 'react';

export const TAG_BASE_CLASS = 'usa-tag';

export enum UswdsTagStyle {
  Default = '',
  Unstyled = 'usa-button--unstyled',
  Secondary = 'usa-button--secondary',
  Cool = 'usa-button--accent-cool',
  Warm = 'usa-button--accent-warm',
  Base = 'usa-button--base',
  Outline = 'usa-button--outline',
  Inverse = 'usa-button--outline usa-button--inverse',
}

export interface TagRef {
  disableTag: (state: boolean) => void;
}

export type TagProps = JSX.IntrinsicElements['span'] & {
  uswdsStyle?: UswdsTagStyle;
  size?: 'default' | 'big';
};

const Tag = (props: TagProps) => {
  const { id, uswdsStyle, size, className, title, children, ...otherProps } = props;

  const classes = [TAG_BASE_CLASS];

  if (uswdsStyle) {
    classes.push(uswdsStyle);
  }

  if (className) {
    classes.push(className);
  }

  if (size === 'big') {
    classes.push('usa-tag--big');
  }

  const tabIndex = props.tabIndex ?? 0;

  const tagId = id ?? `tag-id-${Math.floor(Math.random() * 10000)}`;
  const testId = id ?? 'test';
  return (
    <span
      {...otherProps}
      id={tagId}
      className={'usa-tag ' + classes.join(' ')}
      data-testid={`tag-${testId}`}
      title={title}
      tabIndex={tabIndex}
    >
      {children}
    </span>
  );
};

export default Tag;
