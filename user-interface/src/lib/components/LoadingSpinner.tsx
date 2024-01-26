import './LoadingSpinner.scss';

interface LoadingSpinnerProps {
  id?: string;
  caption?: string;
  className?: string;
}

export function LoadingSpinner(props: LoadingSpinnerProps) {
  const id = props.id || 'loading-spinner';
  return (
    <div id={id} className={`loading-spinner ${props.className ?? ''}`} data-testid={id}>
      <svg
        id="loading-spinner-svg"
        className="animate-spin"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
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
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
      <span className="loading-spinner-caption">{props.caption}</span>
    </div>
  );
}
