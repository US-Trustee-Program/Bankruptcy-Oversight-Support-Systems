import './RichTextButton.scss';
import Button from '../../uswds/Button';
import { RichTextIcon } from './RichTextIcon';

export type RichTextButtonProps = JSX.IntrinsicElements['button'] & {
  icon?: string;
  title: string;
  ariaLabel: string;
  onClick: () => void;
};

export function RichTextButton(props: RichTextButtonProps) {
  const { icon, title, ariaLabel, style, onClick, children } = props;

  return (
    <Button
      type="button"
      aria-label={ariaLabel}
      title={title}
      className="usa-button rich-text-button"
      onClick={onClick}
      style={style}
    >
      {icon && (
        <svg
          className="usa-icon"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 32 32"
          role="img"
          aria-hidden="true"
          focusable="false"
        >
          <RichTextIcon name={icon}></RichTextIcon>
        </svg>
      )}
      {!icon && children}
    </Button>
  );
}
