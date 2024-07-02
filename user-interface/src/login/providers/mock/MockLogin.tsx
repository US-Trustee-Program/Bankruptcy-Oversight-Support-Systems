import { PropsWithChildren, useEffect, useRef, useState } from 'react';
import { RadioGroup } from '@/lib/components/uswds/RadioGroup';
import Radio from '@/lib/components/uswds/Radio';
import { Session } from '@/login/Session';
import Modal from '@/lib/components/uswds/modal/Modal';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import { BlankPage } from '@/login/BlankPage';
import { CamsSession, CamsUser } from '@common/cams/session';
import { usersWithRole, MockRole } from '@common/cams/mock-role';
import apiConfiguration from '@/configuration/apiConfiguration';

export type MockLoginProps = PropsWithChildren & {
  user: CamsUser | null;
};

export function MockLogin(props: MockLoginProps) {
  const [session, setSession] = useState<CamsSession | null>(null);
  const [selectedRole, setSelectedRole] = useState<MockRole | null>(null);
  const [submitDisabled, setSubmitDisabled] = useState<boolean>(true);

  function handleRoleSelection(sub: string) {
    const role = usersWithRole.find((role) => role.sub === sub);
    if (role) setSelectedRole(role);
  }

  async function handleLogin() {
    const { protocol, server, port, basePath } = apiConfiguration;
    if (!selectedRole) return;
    const portString = port ? ':' + port : '';
    const issuer = protocol + '://' + server + portString + basePath + '/oauth2/default';

    if (!URL.canParse(issuer)) {
      console.error('Mock issuer is not a valid URL. Check values in GitHub Actions variables.');
      return;
    }

    const response = await fetch(issuer, {
      method: 'POST',
      body: JSON.stringify({ sub: selectedRole.sub }),
    });
    const payload = await response.json();
    if (!payload) return;

    const newSession: CamsSession = {
      apiToken: payload.token,
      user: selectedRole.user,
      provider: 'mock',
      validatedClaims: {},
    };
    setSession(newSession);
  }

  const modalRef = useRef<ModalRefType>(null);
  const modalId = 'login-modal';

  useEffect(() => {
    modalRef.current?.show(!!session);
  }, []);

  useEffect(() => {
    if (selectedRole) setSubmitDisabled(false);
    modalRef.current?.buttons?.current?.disableSubmitButton(submitDisabled);
  }, [selectedRole, submitDisabled]);

  if (session)
    return (
      <Session
        provider="mock"
        user={session.user}
        apiToken={session.apiToken}
        validatedClaims={session.validatedClaims}
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
            {usersWithRole.map((role, idx) => {
              return (
                <Radio
                  key={`radio-role-${idx}`}
                  id={`radio-role-${idx}`}
                  name="role"
                  label={role.label}
                  value={role.sub}
                  onChange={handleRoleSelection}
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
            onClick: handleLogin,
            disabled: submitDisabled,
          },
        }}
      ></Modal>
    </BlankPage>
  );
}
