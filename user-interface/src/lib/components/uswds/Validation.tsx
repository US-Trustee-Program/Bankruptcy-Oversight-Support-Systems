import Alert, { UswdsAlertStyle } from './Alert';

export type ValidationStep = {
  label: string;
  valid: boolean;
};

export type ValidationProps = {
  id: string;
  title?: string;
  message?: string;
  steps: ValidationStep[] | undefined;
  className?: string;
};

export function Validation(props: ValidationProps) {
  return (
    props.steps && (
      <Alert
        id={`verification-info-${props.id}`}
        className={props.className}
        title={props.title}
        message={
          <>
            <p>{props.message}</p>
            <ul className="verification-info-list">
              {props.steps &&
                props.steps.map((step, idx) => {
                  return (
                    <li
                      key={idx}
                      className={`verification-step ${step.valid === true ? ' valid' : ''}`}
                    >
                      {step.label}
                    </li>
                  );
                })}
            </ul>
          </>
        }
        type={UswdsAlertStyle.Info}
        show={true}
        slim={true}
        inline={true}
      ></Alert>
    )
  );
}
