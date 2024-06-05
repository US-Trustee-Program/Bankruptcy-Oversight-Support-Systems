import { Session, SessionProps } from '@/login/Session';

export type MockSessionProps = SessionProps;

export function MockSession(props: MockSessionProps) {
  return (
    <Session provider="mock" user={props.user}>
      {props.children}
    </Session>
  );
}
