/*
 * The possible strings for icon names should be added to the code in order to make it easier
 * to determine what the possible options are.
 */
export interface IconProps {
  name: string;
  tooltip?: string;
  className?: string;
  focusable?: boolean;
}

export default function Icon(props: IconProps) {
  const link = `/assets/styles/img/sprite.svg#${props.name}`;
  const isFocusable = !!props.focusable;

  return (
    <svg
      className={`usa-icon ${props.className ?? ''}`}
      focusable={isFocusable}
      role="img"
      data-testid="icon"
      aria-label={`${props.name} icon`}
    >
      {props.tooltip && <title>{props.tooltip}</title>}
      <use xlinkHref={link}></use>
    </svg>
  );
}
