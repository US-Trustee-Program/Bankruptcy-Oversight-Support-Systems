import { Session, SessionProps } from '@/login/Session';

export type OktaSessionProps = Omit<SessionProps, 'provider'>;

export function OktaSession(props: OktaSessionProps) {
  return (
    <Session provider="okta" user={props.user}>
      {props.children}
    </Session>
  );
}
