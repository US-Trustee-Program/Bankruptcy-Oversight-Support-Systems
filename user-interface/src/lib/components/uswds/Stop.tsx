import Alert, { UswdsAlertStyle } from './Alert';

type StopProps = {
  id: string;
  title: string;
  message: string;
  showHelpDeskContact?: true;
};

export function Stop(props: StopProps) {
  const { id, title, message, showHelpDeskContact: includeHelpDeskContact } = props;
  return (
    <Alert
      className="measure-6"
      type={UswdsAlertStyle.Warning}
      inline={true}
      show={true}
      title={title}
      id={id}
    >
      <span>
        {message}{' '}
        {includeHelpDeskContact && (
          <>
            Please contact <a href="mailto:UST.Help@ust.doj.gov">UST.Help@ust.doj.gov</a> for
            assistance.
          </>
        )}
      </span>
    </Alert>
  );
}
