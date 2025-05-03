import './LoadingSpinner.scss';

export type LoadingSpinnerProps = JSX.IntrinsicElements['div'] & {
  caption?: string;
  className?: string;
  height?: string;
  hidden?: boolean;
  id?: string;
};

export function LoadingSpinner(props: LoadingSpinnerProps) {
  const { caption, className, height, hidden, id: idProp, ...otherProps } = props;
  const id = idProp || 'loading-spinner-' + Date.now();

  return (
    <div
      {...otherProps}
      className={`loading-spinner ${className ?? ''}`}
      data-testid={id}
      id={id}
      style={{
        height: height ? height : undefined,
        visibility: hidden === true ? 'hidden' : 'visible',
      }}
    >
      <svg
        className="animate-spin"
        fill="none"
        id={`${id}-loading-spinner-svg`}
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        ></circle>
        <path
          className="opacity-75"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          fill="currentColor"
        ></path>
      </svg>
      <span className="loading-spinner-caption">{caption}</span>
    </div>
  );
}
