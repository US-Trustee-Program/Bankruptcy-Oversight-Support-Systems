import Alert, { UswdsAlertStyle } from './uswds/Alert';

type StopProps = {
  asError?: true;
  id: string;
  message: string;
  showHelpDeskContact?: true;
  title: string;
};

export function Stop(props: StopProps) {
  const { asError, id, message, showHelpDeskContact, title } = props;
  return (
    <Alert
      className="measure-6"
      id={id}
      inline={true}
      show={true}
      title={title}
      type={asError ? UswdsAlertStyle.Error : UswdsAlertStyle.Warning}
    >
      <span>
        {message}{' '}
        {showHelpDeskContact && (
          <>
            Please contact <a href="mailto:UST.Help@ust.doj.gov">UST.Help@ust.doj.gov</a> for
            assistance.
          </>
        )}
      </span>
    </Alert>
  );
}
