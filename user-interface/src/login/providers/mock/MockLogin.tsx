import { PropsWithChildren, useEffect, useRef, useState } from 'react';
import { RadioGroup } from '@/lib/components/uswds/RadioGroup';
import Radio from '@/lib/components/uswds/Radio';
import { Session } from '@/login/Session';
import Modal from '@/lib/components/uswds/modal/Modal';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import { BlankPage } from '@/login/BlankPage';
import getApiConfiguration from '@/configuration/apiConfiguration';
import MockUsers, { MockUser } from '@common/cams/test-utilities/mock-user';
import { CamsUser } from '@common/cams/users';
import { CamsSession } from '@common/cams/session';

type MockLoginState = {
  session: CamsSession | null;
  selectedRole: MockUser | null;
  form: {
    submitDisabled: boolean;
  };
};

const config = getApiConfiguration();

function useStateAndActions() {
  const [state, setState] = useState<MockLoginState>({
    session: null,
    selectedRole: null,
    form: {
      submitDisabled: true,
    },
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

    const { protocol, server, port, basePath } = config;
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
      method: 'POST',
      body: JSON.stringify({ sub: state.selectedRole.sub }),
    });
    const payload = await response.json();
    if (!payload.data.value) {
      return;
    }

    newState.session = {
      accessToken: payload.data.value,
      user: state.selectedRole.user,
      provider: 'mock',
      issuer,
      expires: Number.MAX_SAFE_INTEGER,
    };

    setState(newState);
  };

  return {
    state,
    actions: {
      handleRoleSelection,
      handleLogin,
    },
  };
}

export type MockLoginProps = PropsWithChildren & {
  user: CamsUser | null;
};

export function MockLogin(props: MockLoginProps) {
  const { state, actions } = useStateAndActions();

  const modalRef = useRef<ModalRefType>(null);
  const modalId = 'login-modal';

  useEffect(() => {
    if (state.session) {
      modalRef.current?.show({});
    }
  }, []);

  if (state.session)
    return (
      <Session
        provider="mock"
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
        heading={'Login'}
        content={
          <RadioGroup label="Choose a role:">
            {MockUsers.filter((role) => !role.hide).map((role, idx) => {
              return (
                <Radio
                  key={`role-${idx}`}
                  id={`role-${idx}`}
                  name="role"
                  label={role.label}
                  value={role.sub}
                  onChange={actions.handleRoleSelection}
                />
              );
            })}
          </RadioGroup>
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
