import Alert, { UswdsAlertStyle } from './uswds/Alert';
import CommsLink from './cams/CommsLink/CommsLink';

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
            <CommsLink contact={{ email: 'UST.Help@ust.doj.gov' }} mode="email" hideIcon /> for
            assistance.
          </>
        )}
      </span>
    </Alert>
  );
}
