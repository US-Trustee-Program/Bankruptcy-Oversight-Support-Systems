import { type JSX } from 'react';

type ClosedCasesHintMessageProps = {
  message: string;
  onIncludeClosedCases?: () => void;
};

export function ClosedCasesHintMessage({
  message,
  onIncludeClosedCases,
}: ClosedCasesHintMessageProps): JSX.Element {
  return (
    <p className="usa-alert__text">
      {message}{' '}
      <button
        type="button"
        className="usa-button usa-button--unstyled"
        onClick={() => onIncludeClosedCases?.()}
      >
        Include Closed Cases
      </button>
    </p>
  );
}
