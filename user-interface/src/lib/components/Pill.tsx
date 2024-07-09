import './Pill.scss';
import Icon from './uswds/Icon';

const defaultColor = 'black';
const defaultBackgroundColor = '#d0d0d0';

type PillProps = {
  id: string;
  className?: string;
  color?: string;
  backgroundColor?: string;
  label: string;
  ariaLabelPrefix?: string;
  value: string;
  wrapText?: boolean;
  onClick: (value: string) => void;
  disabled?: boolean;
};

export function Pill(props: PillProps) {
  const color = props.color ?? defaultColor;
  const backgroundColor = props.backgroundColor ?? defaultBackgroundColor;

  function handleKeyDown(ev: React.KeyboardEvent) {
    if (ev.key === 'Enter' || ev.key === ' ') {
      props.onClick(props.value);
      ev.preventDefault();
    }
  }

  const wrapTextClass = props.wrapText === true ? 'wrap-text' : '';

  return (
    <button
      id={props.id}
      data-testid={`pill-${props.id}`}
      className={`pill usa-button--unstyled ${wrapTextClass}`}
      style={{ backgroundColor, color }}
      onClick={() => props.onClick(props.value)}
      onKeyDown={(ev) => handleKeyDown(ev)}
      tabIndex={0}
      aria-label={`${props.ariaLabelPrefix} - ${props.label} is currently selected.`}
      disabled={props.disabled}
      data-value={props.value}
      title={`${props.label}`}
    >
      <div className="pill-text">{props.label}</div>
      <Icon name="close"></Icon>
    </button>
  );
}
