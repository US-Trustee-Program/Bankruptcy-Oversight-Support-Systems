import { Session, SessionProps } from '@/login/Session';

export type MockSessionProps = SessionProps;

export function MockSession(props: MockSessionProps) {
  return <Session user={props.user}>{props.children}</Session>;
}
