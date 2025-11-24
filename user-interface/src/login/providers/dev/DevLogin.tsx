import { PropsWithChildren, useEffect, useRef, useState } from 'react';
import { Session } from '@/login/Session';
import Modal from '@/lib/components/uswds/modal/Modal';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import { BlankPage } from '@/login/BlankPage';
import getApiConfiguration from '@/configuration/apiConfiguration';
import { CamsUser } from '@common/cams/users';
import { CamsSession } from '@common/cams/session';
import Input from '@/lib/components/uswds/Input';
import Alert, { AlertDetails, UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { AccessDenied } from '@/login/AccessDenied';

type DevLoginState = {
  session: CamsSession | null;
  username: string;
  password: string;
  form: {
    submitDisabled: boolean;
  };
  alert: AlertDetails | null;
  accessDenied: string | null;
};

const config = getApiConfiguration();

export function useStateAndActions() {
  const [state, setState] = useState<DevLoginState>({
    session: null,
    username: '',
    password: '',
    form: {
      submitDisabled: true,
    },
    alert: null,
    accessDenied: null,
  });

  const handleUsernameChange = (value: string) => {
    const newState = { ...state };
    newState.username = value;
    newState.form.submitDisabled = !value || !state.password;
    newState.alert = null;
    setState(newState);
  };

  const handlePasswordChange = (value: string) => {
    const newState = { ...state };
    newState.password = value;
    newState.form.submitDisabled = !state.username || !value;
    newState.alert = null;
    setState(newState);
  };

  const handleLogin = async () => {
    const newState = { ...state };

    const { protocol, server, port, basePath } = config;
    const portString = port ? ':' + port : '';
    const issuer = protocol + '://' + server + portString + basePath + '/oauth2/default';

    if (!URL.canParse(issuer)) {
      console.error('Dev issuer is not a valid URL. Check values in configuration.');
      newState.alert = {
        message: 'Configuration error. Invalid issuer URL.',
        type: UswdsAlertStyle.Error,
        timeOut: 8,
      };
      setState(newState);
      return;
    }

    try {
      const response = await fetch(issuer, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: state.username, password: state.password }),
      });

      if (!response.ok) {
        newState.accessDenied = 'Invalid username or password.';
        setState(newState);
        return;
      }

      const payload = await response.json();
      if (!payload.data.value) {
        newState.accessDenied = 'Authentication failed. No token received.';
        setState(newState);
        return;
      }

      // Decode JWT to get user info
      const token = payload.data.value;
      const parts = token.split('.');
      if (parts.length !== 3) {
        newState.accessDenied = 'Invalid token format.';
        setState(newState);
        return;
      }

      const payloadJson = JSON.parse(atob(parts[1]));

      newState.session = {
        accessToken: token,
        user: null as unknown as CamsUser, // Will be populated by Session component
        provider: 'dev',
        issuer,
        expires: payloadJson.exp,
      };

      setState(newState);
    } catch (error) {
      console.error('Login error:', error);
      newState.accessDenied = 'Login failed. Please try again.';
      setState(newState);
    }
  };

  return {
    state,
    actions: {
      handleUsernameChange,
      handlePasswordChange,
      handleLogin,
    },
  };
}

export type DevLoginProps = PropsWithChildren & {
  user: CamsUser | null;
};

export function DevLogin(props: DevLoginProps) {
  const { state, actions } = useStateAndActions();

  const modalRef = useRef<ModalRefType>(null);
  const modalId = 'login-modal';

  useEffect(() => {
    modalRef.current?.show({});
  }, []);

  if (state.accessDenied) {
    return <AccessDenied message={state.accessDenied} />;
  }

  if (state.session)
    return (
      <Session
        provider="dev"
        user={state.session.user}
        accessToken={state.session.accessToken}
        expires={state.session.expires}
        issuer={state.session.issuer}
      >
        {props.children}
      </Session>
    );

  return (
    <BlankPage>
      <Modal
        ref={modalRef}
        modalId={modalId}
        heading={'Developer Login'}
        content={
          <div>
            {state.alert && (
              <Alert
                message={state.alert.message}
                type={state.alert.type}
                timeout={state.alert.timeOut}
              />
            )}
            <Input
              id="username"
              name="username"
              label="Username"
              value={state.username}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                actions.handleUsernameChange(e.target.value)
              }
              required={true}
              autoComplete="off"
            />
            <Input
              id="password"
              name="password"
              label="Password"
              type="password"
              value={state.password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                actions.handlePasswordChange(e.target.value)
              }
              required={true}
              autoComplete="off"
            />
          </div>
        }
        forceAction={true}
        actionButtonGroup={{
          modalId,
          modalRef,
          submitButton: {
            label: 'Login',
            onClick: actions.handleLogin,
            disabled: state.form.submitDisabled,
          },
        }}
      ></Modal>
    </BlankPage>
  );
}
