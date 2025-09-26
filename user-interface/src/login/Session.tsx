import { PropsWithChildren, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { LOGIN_PATHS, LOGIN_BASE_PATH } from './login-library';
import { LocalStorage } from '@/lib/utils/local-storage';
import Api2 from '@/lib/models/api2';
import { AccessDenied } from './AccessDenied';
import { Interstitial } from './Interstitial';
import { CamsSession } from '@common/cams/session';
import { CamsUser } from '@common/cams/users';
import useCamsNavigator from '@/lib/hooks/UseCamsNavigator';
import { initializeSessionEndLogout } from './session-end-logout';
import { getAppInsights } from '@/lib/hooks/UseApplicationInsights';

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
  const navigator = useCamsNavigator();
  const location = useLocation();
  const { state, actions } = useStateAndActions();
  const { appInsights } = getAppInsights();

  useEffect(() => {
    const preflight: CamsSession = { accessToken, provider, user, expires, issuer };
    LocalStorage.setSession(preflight);
    actions.getMe();
  }, []);

  useEffect(() => {
    if (LOGIN_PATHS.includes(location.pathname)) {
      navigator.navigateTo(LOGIN_BASE_PATH);
    }
  }, [state.isLoaded && !state.isError]);

  if (!state.isLoaded) {
    return (
      <Interstitial id="interstital-loading-session" caption="Loading session..."></Interstitial>
    );
  }

  if (state.isError) {
    appInsights.trackEvent(
      { name: 'Session state error' },
      {
        error: { message: state.errorMessage },
        note: `This is a session state error. This did not occur during login.`,
      },
    );
    return <AccessDenied message={state.errorMessage ?? undefined}></AccessDenied>;
  }

  return <>{props.children}</>;
}
