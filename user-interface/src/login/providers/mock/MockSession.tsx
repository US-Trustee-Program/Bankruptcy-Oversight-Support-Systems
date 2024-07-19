import { Session, SessionProps } from '@/login/Session';
import { MockData } from '@common/cams/test-utilities/mock-data';

export type MockSessionProps = Omit<SessionProps, 'provider' | 'accessToken' | 'validatedClaims'>;

export function MockSession(props: MockSessionProps) {
  return (
    <Session
      provider="mock"
      user={props.user}
      accessToken={MockData.getJwt()}
      expires={Number.MAX_SAFE_INTEGER}
      validatedClaims={{}}
    >
      {props.children}
    </Session>
  );
}
