export interface IconProps {
  name: string;
  focusable?: boolean;
}

export default function Icon(props: IconProps) {
  const link = `/node_modules/@uswds/uswds/dist/img/sprite.svg#${props.name}`;
  const isFocusable = props.focusable ? 'true' : 'false';

  return (
    <svg className="usa-icon" aria-hidden="true" focusable={isFocusable} role="img">
      <use xlinkHref={link}></use>
    </svg>
  );
}
