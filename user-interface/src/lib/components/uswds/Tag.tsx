import { JSX } from 'react';

export enum UswdsTagStyle {
  Default = 'bg-base',
  Cool = 'bg-accent-cool',
  CoolLight = 'bg-accent-cool-light',
  Warm = 'bg-accent-warm-dark',
  Primary = 'bg-primary',
}

export type TagProps = JSX.IntrinsicElements['span'] & {
  uswdsStyle?: UswdsTagStyle;
};

const Tag = (props: TagProps) => {
  const { id, uswdsStyle, className, title, children, ...otherProps } = props;

  const classes = ['usa-tag', 'usa-tag--big', 'text-no-uppercase'];

  if (uswdsStyle) {
    classes.push(uswdsStyle);
  }

  if (className) {
    classes.push(className);
  }

  const tabIndex = props.tabIndex ?? 0;

  const tagId = id ?? `tag-id-${Math.floor(Math.random() * 10000)}`;
  const testId = id ?? 'test';
  return (
    <span
      {...otherProps}
      id={tagId}
      className={classes.join(' ')}
      data-testid={`tag-${testId}`}
      title={title}
      tabIndex={tabIndex}
    >
      {children}
    </span>
  );
};

export default Tag;
