import './IconInput.scss';
import Icon from './uswds/Icon';

export interface IconInputProps {
  id: string;
  className?: string;
  type?: string;
  name?: string;
  icon: string;
  position?: 'left' | 'right';
  onChange?: () => void;
}

export default function IconInput(props: IconInputProps) {
  return (
    <div className="ustp-icon-input">
      <input
        className={`usa-input ${props.className}`}
        id={props.id}
        type={props.type}
        name={props.name}
        onChange={props.onChange}
        data-testid={props.id}
      />
      <Icon className={`usa-icon ${props.className}`} name={props.icon}></Icon>
    </div>
  );
}
