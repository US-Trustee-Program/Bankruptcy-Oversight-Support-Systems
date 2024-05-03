import { PropsWithChildren, useEffect, useRef, useState } from 'react';
import { RadioGroup } from '@/lib/components/uswds/RadioGroup';
import Radio from '@/lib/components/uswds/Radio';
import { Session } from '@/login/Session';
import Modal from '@/lib/components/uswds/modal/Modal';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import { BlankPage } from '@/login/BlankPage';
import { CamsUser } from '@/login/LoginProvider';

type MockRole = {
  key: string;
  label: string;
  user: CamsUser;
};

const roles: MockRole[] = [
  { key: 'trial-attorney', label: 'Trial Attorney', user: { name: 'Abe' } },
  { key: 'paralegal', label: 'Paralegal', user: { name: 'Bert' } },
  { key: 'aust', label: 'Assistant US Trustee', user: { name: 'Charlie' } },
];

export type MockAuthProviderProps = PropsWithChildren & {
  user: CamsUser | null;
};

export default function MockAuthProvider(props: MockAuthProviderProps): React.ReactNode {
  const [user, setUser] = useState<CamsUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<MockRole | null>(null);

  function handleRoleSelection(key: string) {
    setSelectedRole(roles.find((role) => role.key === key) ?? null);
  }

  function handleLogin() {
    if (selectedRole) setUser(selectedRole.user);
  }

  const modalRef = useRef<ModalRefType>(null);
  const modalId = 'login-modal';

  useEffect(() => {
    modalRef.current?.show(true);
  });

  if (user) return <Session user={user}>{props.children}</Session>;

  return (
    <BlankPage>
      <Modal
        ref={modalRef}
        modalId={modalId}
        heading={'Login'}
        content={
          <>
            <RadioGroup label="Choose a role to impersonate:">
              {roles.map((role, idx) => {
                return (
                  <Radio
                    key={`radio-role-${idx}`}
                    id={`radio-role-${idx}`}
                    name="role"
                    label={role.label}
                    value={role.key}
                    onChange={handleRoleSelection}
                  />
                );
              })}
            </RadioGroup>
          </>
        }
        forceAction={true}
        actionButtonGroup={{
          modalId,
          modalRef,
          submitButton: {
            label: 'Login',
            onClick: handleLogin,
          },
        }}
      ></Modal>
    </BlankPage>
  );
}
