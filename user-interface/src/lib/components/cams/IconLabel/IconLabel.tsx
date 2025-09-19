import './IconLabel.scss';
import Icon from '../../uswds/Icon';

export type IconLabelProps = {
  className?: string;
  label: string;
  icon: string;
  location?: 'left' | 'right';
};

export function IconLabel(props: IconLabelProps) {
  let location = 'left';
  if (props.location) {
    location = props.location;
  }

  return (
    <span className={`cams-icon-label ${props.className ?? ''}`}>
      {location === 'left' && (
        <>
          <Icon className={props.className ?? undefined} name={props.icon} />
          <span>{props.label}</span>
        </>
      )}
      {location === 'right' && (
        <>
          <span>{props.label}</span>
          <Icon className={props.className ?? undefined} name={props.icon} />
        </>
      )}
    </span>
  );
}
