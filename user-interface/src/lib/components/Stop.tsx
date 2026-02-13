import Alert, { UswdsAlertStyle } from './uswds/Alert';

type StopProps = {
  id: string;
  title: string;
  message: string;
  showHelpDeskContact?: true;
  asError?: true;
};

export function Stop(props: StopProps) {
  const { id, title, message, showHelpDeskContact, asError } = props;
  return (
    <Alert
      className="measure-6"
      type={asError ? UswdsAlertStyle.Error : UswdsAlertStyle.Warning}
      inline={true}
      show={true}
      title={title}
      id={id}
    >
      <span>
        {message}{' '}
        {showHelpDeskContact && (
          <>
            Please contact{' '}
            <a href="mailto:UST.Help@ust.doj.gov" aria-label="Email: UST.Help@ust.doj.gov">
              UST.Help@ust.doj.gov
            </a>{' '}
            for assistance.
          </>
        )}
      </span>
    </Alert>
  );
}
