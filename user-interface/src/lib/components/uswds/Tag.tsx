import './Tag.scss';
import { JSX } from 'react';

export enum UswdsTagStyle {
  Default = 'bg-base',
  Cool = 'bg-accent-cool',
  CoolLight = 'bg-accent-cool-light',
  Warm = 'bg-accent-warm-dark',
  Primary = 'bg-primary',
  Green = 'bg-success',
  BaseDarkest = 'bg-base-darkest',
  Secondary = 'bg-secondary',
  SecondaryDark = 'bg-secondary-dark',
}

type TagProps = JSX.IntrinsicElements['span'] & {
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

  const tagId = id ?? `tag-id-${Math.floor(Math.random() * 10000)}`;
  const testId = id ?? 'test';
  return (
    <span
      {...otherProps}
      id={tagId}
      className={classes.join(' ')}
      data-testid={`tag-${testId}`}
      title={title}
    >
      {children}
    </span>
  );
};

export default Tag;
