import useCamsNavigator from '@/lib/hooks/UseCamsNavigator';
import Api2 from '@/lib/models/api2';
import { LocalStorage } from '@/lib/utils/local-storage';
import { CamsSession } from '@common/cams/session';
import { CamsUser } from '@common/cams/users';
import { PropsWithChildren, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { AccessDenied } from './AccessDenied';
import { Interstitial } from './Interstitial';
import { LOGIN_BASE_PATH, LOGIN_PATHS } from './login-library';
import { initializeSessionEndLogout } from './session-end-logout';

export type SessionProps = Omit<CamsSession, 'user'> & PropsWithChildren & { user?: CamsUser };

type SessionState = {
  errorMessage: null | string;
  isError: boolean;
  isLoaded: boolean;
};

export function Session(props: SessionProps) {
  const { accessToken, expires, issuer, provider } = props;
  const user = props.user ?? { id: '', name: '' };
  const navigator = useCamsNavigator();
  const location = useLocation();
  const { actions, state } = useStateAndActions();

  useEffect(() => {
    const preflight: CamsSession = { accessToken, expires, issuer, provider, user };
    LocalStorage.setSession(preflight);
    actions.getMe();
  }, []);

  useEffect(() => {
    if (LOGIN_PATHS.includes(location.pathname)) {
      navigator.navigateTo(LOGIN_BASE_PATH);
    }
  }, [state.isLoaded === true && !state.isError]);

  if (!state.isLoaded) {
    return (
      <Interstitial caption="Loading session..." id="interstital-loading-session"></Interstitial>
    );
  }

  if (state.isError) {
    return <AccessDenied message={state.errorMessage ?? undefined}></AccessDenied>;
  }

  return <>{props.children}</>;
}

export function useStateAndActions() {
  const [state, setState] = useState<SessionState>({
    errorMessage: '',
    isError: false,
    isLoaded: false,
  });

  function postLoginTasks(session: CamsSession) {
    initializeSessionEndLogout(session);
    session.user.offices?.forEach((office) => {
      Api2.getOfficeAttorneys(office.officeCode);
    });
  }

  function getMe() {
    if (state.isLoaded) return;
    const newState = { ...state };
    Api2.getMe()
      .then((response) => {
        const session = response.data;
        LocalStorage.setSession(session);
        postLoginTasks(session);
      })
      .catch((error) => {
        newState.isError = true;
        newState.errorMessage = error.message;
      })
      .finally(() => {
        newState.isLoaded = true;
        setState(newState);
      });
  }

  return {
    actions: {
      getMe,
    },
    state,
  };
}
