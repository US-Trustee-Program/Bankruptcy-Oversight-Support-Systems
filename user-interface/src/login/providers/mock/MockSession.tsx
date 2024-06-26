import { Session, SessionProps } from '@/login/Session';
import { MockData } from '@common/cams/test-utilities/mock-data';

export type MockSessionProps = Omit<SessionProps, 'provider' | 'apiToken' | 'validatedClaims'>;

export function MockSession(props: MockSessionProps) {
  return (
    <Session provider="mock" user={props.user} apiToken={MockData.getJwt()} validatedClaims={{}}>
      {props.children}
    </Session>
  );
}
