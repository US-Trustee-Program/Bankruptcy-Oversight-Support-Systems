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
        inline={true}
        message={props.message}
        show={true}
        title="Bad Configuration"
        type={UswdsAlertStyle.Error}
      ></Alert>
    </BlankPage>
  );
}
