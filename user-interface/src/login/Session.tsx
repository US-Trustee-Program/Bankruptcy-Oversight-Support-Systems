import { PropsWithChildren, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LOGIN_PATHS, LOGIN_SUCCESS_PATH } from './login-library';
import { LocalStorage } from '@/lib/utils/local-storage';
import { CamsSession } from '@common/cams/session';
import Api2 from '@/lib/hooks/UseApi2';
import { AccessDenied } from './AccessDenied';
import { BlankPage } from './BlankPage';

type SessionState = {
  isLoaded: boolean;
  isError: boolean;
  errorMessage: string | null;
};

export function useActions() {
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
          console.log('session from API', session);
          LocalStorage.setSession(session);
          newState.isLoaded = true;
        } else {
          newState.isError = true;
          newState.errorMessage = 'Something went wrong';
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

export type SessionProps = CamsSession & PropsWithChildren;

export function Session(props: SessionProps) {
  const { accessToken, provider, user, expires, validatedClaims } = props;
  const navigate = useNavigate();
  const location = useLocation();
  const { state, actions } = useActions();

  useEffect(() => {
    const preflight: CamsSession = { accessToken, provider, user, expires, validatedClaims };
    LocalStorage.setSession(preflight);
    actions.getMe();
  }, []);

  useEffect(() => {
    if (LOGIN_PATHS.includes(location.pathname)) navigate(LOGIN_SUCCESS_PATH);
  }, [state.isLoaded === true]);

  if (!state.isLoaded) {
    return <BlankPage>Loading AUGMENTED session from Cams API</BlankPage>;
  }

  if (state.isError) {
    return <AccessDenied message={state.errorMessage ?? undefined}></AccessDenied>;
  }

  if (state.isLoaded && !state.isError) {
    //if (LOGIN_PATHS.includes(location.pathname)) return <></>;
    return <>{props.children}</>;
  }
}
