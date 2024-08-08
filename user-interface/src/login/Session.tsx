import { PropsWithChildren, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LOGIN_PATHS, LOGIN_SUCCESS_PATH } from './login-library';
import { LocalStorage } from '@/lib/utils/local-storage';
import Api2 from '@/lib/hooks/UseApi2';
import { AccessDenied } from './AccessDenied';
import { Interstitial } from './Interstitial';
import { CamsSession } from '@common/cams/session';
import { CamsUser } from '@common/cams/users';

type SessionState = {
  isLoaded: boolean;
  isError: boolean;
  errorMessage: string | null;
};

export function useStateAndActions() {
  const [state, setState] = useState<SessionState>({
    isLoaded: false,
    isError: false,
    errorMessage: '',
  });

  function getMe() {
    if (state.isLoaded) return;
    const newState = { ...state };
    Api2.getMe()
      .then((response) => {
        if (response.isSuccess) {
          const session = response.data;
          LocalStorage.setSession(session);
          newState.isLoaded = true;
        } else {
          newState.isError = true;
          newState.errorMessage = 'Unable to retrieve user session.';
        }
      })
      .catch((error) => {
        newState.isError = true;
        newState.errorMessage = error.message;
      })
      .finally(() => {
        setState(newState);
      });
  }

  return {
    state,
    actions: {
      getMe,
    },
  };
}

export type SessionProps = Omit<CamsSession, 'user'> & PropsWithChildren & { user?: CamsUser };

export function Session(props: SessionProps) {
  const { accessToken, provider, expires, issuer } = props;
  const user = props.user ?? { id: '', name: '' };
  const navigate = useNavigate();
  const location = useLocation();
  const { state, actions } = useStateAndActions();

  useEffect(() => {
    const preflight: CamsSession = { accessToken, provider, user, expires, issuer };
    LocalStorage.setSession(preflight);
    actions.getMe();
  }, []);

  useEffect(() => {
    if (LOGIN_PATHS.includes(location.pathname)) navigate(LOGIN_SUCCESS_PATH);
  }, [state.isLoaded === true]);

  if (!state.isLoaded) {
    return (
      <Interstitial id="interstital-loading-session" caption="Loading session..."></Interstitial>
    );
  }

  if (state.isError) {
    return <AccessDenied message={state.errorMessage ?? undefined}></AccessDenied>;
  }

  if (state.isLoaded && !state.isError) {
    return <>{props.children}</>;
  }
}
