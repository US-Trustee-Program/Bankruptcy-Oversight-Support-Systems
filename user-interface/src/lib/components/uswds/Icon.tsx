/*
 * The possible strings for icon names should be added to the code in order to make it easier
 * to determine what the possible options are.
 */
export interface IconProps {
  className?: string;
  focusable?: boolean;
  name: string;
  tooltip?: string;
}

export default function Icon(props: IconProps) {
  const link = `/assets/styles/img/sprite.svg#${props.name}`;
  const isFocusable = !!props.focusable;

  return (
    <svg
      aria-hidden="true"
      className={`usa-icon ${props.className ?? ''}`}
      data-testid="icon"
      focusable={isFocusable}
      role="img"
    >
      {props.tooltip && <title>{props.tooltip}</title>}
      <use xlinkHref={link}></use>
    </svg>
  );
}
