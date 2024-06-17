import { MOCK_AUTHORIZATION_BEARER_TOKEN } from '@/login/login-library';
import { Session, SessionProps } from '@/login/Session';

export type MockSessionProps = Omit<SessionProps, 'provider' | 'apiToken'>;

export function MockSession(props: MockSessionProps) {
  return (
    <Session provider="mock" user={props.user} apiToken={MOCK_AUTHORIZATION_BEARER_TOKEN}>
      {props.children}
    </Session>
  );
}
