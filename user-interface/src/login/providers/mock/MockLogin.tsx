import apiConfiguration from '@/configuration/apiConfiguration';
import Modal from '@/lib/components/uswds/modal/Modal';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import Radio from '@/lib/components/uswds/Radio';
import { RadioGroup } from '@/lib/components/uswds/RadioGroup';
import { BlankPage } from '@/login/BlankPage';
import { Session } from '@/login/Session';
import { CamsSession } from '@common/cams/session';
import { MockUser, MockUsers } from '@common/cams/test-utilities/mock-user';
import { CamsUser } from '@common/cams/users';
import { PropsWithChildren, useEffect, useRef, useState } from 'react';

export type MockLoginProps = PropsWithChildren & {
  user: CamsUser | null;
};

type MockLoginState = {
  form: {
    submitDisabled: boolean;
  };
  selectedRole: MockUser | null;
  session: CamsSession | null;
};

export function MockLogin(props: MockLoginProps) {
  const { actions, state } = useStateAndActions();

  const modalRef = useRef<ModalRefType>(null);
  const modalId = 'login-modal';

  useEffect(() => {
    modalRef.current?.show(!!state.session);
  }, []);

  if (state.session)
    return (
      <Session
        accessToken={state.session.accessToken}
        expires={state.session.expires}
        issuer={state.session.issuer}
        provider="mock"
        user={state.session.user}
      >
        {props.children}
      </Session>
    );

  return (
    <BlankPage>
      <Modal
        actionButtonGroup={{
          modalId,
          modalRef,
          submitButton: {
            disabled: state.form.submitDisabled,
            label: 'Login',
            onClick: actions.handleLogin,
          },
        }}
        content={
          <RadioGroup label="Choose a role:">
            {MockUsers.filter((role) => !role.hide).map((role, idx) => {
              return (
                <Radio
                  id={`role-${idx}`}
                  key={`role-${idx}`}
                  label={role.label}
                  name="role"
                  onChange={actions.handleRoleSelection}
                  value={role.sub}
                />
              );
            })}
          </RadioGroup>
        }
        forceAction={true}
        heading={'Login'}
        modalId={modalId}
        ref={modalRef}
      ></Modal>
    </BlankPage>
  );
}

export function useStateAndActions() {
  const [state, setState] = useState<MockLoginState>({
    form: {
      submitDisabled: true,
    },
    selectedRole: null,
    session: null,
  });

  const handleRoleSelection = (sub: string) => {
    const newState = { ...state };
    const role = MockUsers.find((role) => role.sub === sub);
    if (role) {
      newState.selectedRole = role;
      newState.form.submitDisabled = false;
    }
    setState(newState);
  };

  const handleLogin = async () => {
    const newState = { ...state };

    const { basePath, port, protocol, server } = apiConfiguration;
    if (!state.selectedRole) {
      return;
    }

    const portString = port ? ':' + port : '';
    const issuer = protocol + '://' + server + portString + basePath + '/oauth2/default';

    if (!URL.canParse(issuer)) {
      console.error('Mock issuer is not a valid URL. Check values in GitHub Actions variables.');
      return;
    }

    const response = await fetch(issuer, {
      body: JSON.stringify({ sub: state.selectedRole.sub }),
      method: 'POST',
    });
    const payload = await response.json();
    if (!payload.data.value) {
      return;
    }

    newState.session = {
      accessToken: payload.data.value,
      expires: Number.MAX_SAFE_INTEGER,
      issuer,
      provider: 'mock',
      user: state.selectedRole.user,
    };

    setState(newState);
  };

  return {
    actions: {
      handleLogin,
      handleRoleSelection,
    },
    state,
  };
}
