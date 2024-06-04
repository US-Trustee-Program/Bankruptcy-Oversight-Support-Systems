import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { BlankPage } from './BlankPage';

export type BadConfigurationProps = {
  message: string;
};

export function BadConfiguration(props: BadConfigurationProps) {
  return (
    <BlankPage>
      <Alert
        className="measure-6"
        show={true}
        inline={true}
        type={UswdsAlertStyle.Error}
        title="Bad Configuration"
        message={props.message}
      ></Alert>
    </BlankPage>
  );
}
