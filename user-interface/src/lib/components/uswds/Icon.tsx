/*
 * The possible strings for icon names should be added to the code in order to make it easier
 * to determine what the possible options are.
 */
export interface IconProps {
  name: string;
  className?: string;
  focusable?: boolean;
}

export default function Icon(props: IconProps) {
  const link = `/assets/styles/img/sprite.svg#${props.name}`;
  const isFocusable = props.focusable ? 'true' : 'false';

  return (
    <svg
      className={`usa-icon ${props.className}`}
      aria-hidden="true"
      focusable={isFocusable}
      role="img"
    >
      <use xlinkHref={link}></use>
    </svg>
  );
}
