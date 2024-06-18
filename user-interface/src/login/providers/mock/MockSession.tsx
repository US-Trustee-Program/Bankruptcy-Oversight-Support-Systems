import { Session, SessionProps } from '@/login/Session';

export type MockSessionProps = Omit<SessionProps, 'provider'>;

export function MockSession(props: MockSessionProps) {
  return (
    <Session provider="mock" user={props.user}>
      {props.children}
    </Session>
  );
}
