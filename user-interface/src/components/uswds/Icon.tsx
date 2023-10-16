import sprite from '@uswds/uswds/img/sprite.svg';

/*
 * The possible strings for icon names should be added to the code in order to make it easier
 * to determine what the possible options are.
 */
export interface IconProps {
  name: string;
  focusable?: boolean;
}

export default function Icon(props: IconProps) {
  const link = `${sprite}#${props.name}`;
  const isFocusable = props.focusable ? 'true' : 'false';

  return (
    <svg className="usa-icon" aria-hidden="true" focusable={isFocusable} role="img">
      <use xlinkHref={link}></use>
    </svg>
  );
}
