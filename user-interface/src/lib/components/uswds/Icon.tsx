/*
 * The possible strings for icon names should be added to the code in order to make it easier
 * to determine what the possible options are.
 */
export interface IconProps {
  name: string;
  /** Sets the icon's accessible name (aria-label) when non-decorative. Does not render a visible
   * tooltip on its own - pair with a `title` attribute on a wrapping element (or adjacent visible
   * text) if sighted mouse users also need to discover the icon's meaning on hover. */
  tooltip?: string;
  className?: string;
  decorative?: boolean;
}

export default function Icon(props: IconProps) {
  const link = `/assets/styles/img/sprite.svg#${props.name}`;
  const isDecorative = props.decorative ?? true;

  return (
    <svg
      className={`usa-icon ${props.className ?? ''}`}
      focusable="false"
      role={isDecorative ? undefined : 'img'}
      aria-hidden={isDecorative ? 'true' : undefined}
      data-testid="icon"
      aria-label={isDecorative ? undefined : props.tooltip || `${props.name} icon`}
    >
      <use xlinkHref={link}></use>
    </svg>
  );
}
