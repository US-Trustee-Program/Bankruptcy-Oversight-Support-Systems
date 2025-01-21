import './PrivilegedIdentity.scss';
import ComboBox, { ComboOption } from '@/lib/components/combobox/ComboBox';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import Button, { ButtonRef, UswdsButtonStyle } from '@/lib/components/uswds/Button';
import DatePicker from '@/lib/components/uswds/DatePicker';
import useApi2 from '@/lib/hooks/UseApi2';
import useFeatureFlags, { PRIVILEGED_IDENTITY_MANAGEMENT } from '@/lib/hooks/UseFeatureFlags';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import { ComboBoxRef, InputRef } from '@/lib/type-declarations/input-fields';
import {
  ElevatePrivilegedUserAction,
  RoleAndOfficeGroupNames,
} from '@common/cams/privileged-identity';
import { CamsUserReference } from '@common/cams/users';
import { useEffect, useRef, useState } from 'react';

function toComboOption(groupName: string) {
  return {
    value: groupName,
    label: groupName.replace('USTP CAMS ', ''),
  };
}

export default function PrivilegedIdentity() {
  const flags = useFeatureFlags();
  const api = useApi2();

  const [isLoaded, setIsLoaded] = useState(false);
  const [groupNames, setGroupNames] = useState<RoleAndOfficeGroupNames>({
    roles: [],
    offices: [],
  });
  const [userList, setUserList] = useState<CamsUserReference[]>([]);
  const [selectedUser, setSelectedUser] = useState<CamsUserReference | null>(null);

  const userListRef = useRef<ComboBoxRef>(null);
  const officeListRef = useRef<ComboBoxRef>(null);
  const roleListRef = useRef<ComboBoxRef>(null);
  const datePickerRef = useRef<InputRef>(null);
  const saveButtonRef = useRef<ButtonRef>(null);
  const cancelButtonRef = useRef<ButtonRef>(null);
  const deleteButtonRef = useRef<ButtonRef>(null);

  const alert = useGlobalAlert();

  // Stop if the feature is disabled.
  if (!flags[PRIVILEGED_IDENTITY_MANAGEMENT]) {
    return (
      <Alert type={UswdsAlertStyle.Info} inline={true} show={true} title="Notice">
        Privileged Identity Management is disabled in this environment.
      </Alert>
    );
  }

  function enableForm(enable: boolean = true) {
    officeListRef.current?.disable(!enable);
    roleListRef.current?.disable(!enable);
    datePickerRef.current?.disable(!enable);
    deleteButtonRef.current?.disableButton(!enable);
    saveButtonRef.current?.disableButton(!enable);
    cancelButtonRef.current?.disableButton(!enable);
  }

  function handleSelectUser(options: ComboOption[]) {
    if (options?.length === 1) {
      const userId = options[0].value;
      setSelectedUser(userList.find((user) => user.id === options[0].value)!);
      if (userId) {
        api
          .getPrivilegedIdentityUser(userId)
          .then((response) => {
            const groups = response.data.claims.groups;
            const expires = response.data.expires;

            officeListRef.current?.setValue(
              groupNames.offices
                .filter((groupName) => groups.includes(groupName))
                .map((groupName) => toComboOption(groupName)),
            );
            roleListRef.current?.setValue(
              groupNames.roles
                .filter((groupName) => groups.includes(groupName))
                .map((groupName) => toComboOption(groupName)),
            );
            datePickerRef.current?.setValue(expires);
            enableForm(true);
          })
          .catch(() => {
            officeListRef.current?.clearValue();
            roleListRef.current?.clearValue();
            datePickerRef.current?.clearValue();
            enableForm(true);
            deleteButtonRef.current?.disableButton(true);
          });
      }
    } else {
      enableForm(false);
    }
  }

  async function handleSave() {
    const userId = userListRef.current?.getValue()[0].value;
    const permissions: ElevatePrivilegedUserAction = {
      groups: [
        ...(roleListRef.current?.getValue().map((option) => option.value) || []),
        ...(officeListRef.current?.getValue().map((option) => option.value) || []),
      ],
      expires: datePickerRef.current?.getValue() ?? new Date().toISOString().split('T')[0],
    };
    try {
      await api.putPrivilegedIdentityUser(userId, permissions).then(() => {
        alert?.success('Privileged Identity saved successfully.');
      });
    } catch (e) {
      alert?.warning(`Failed to save Privileged Indentity. ${(e as Error).message}`);
    }
  }

  async function handleDelete() {
    const userId = userListRef.current?.getValue()[0].value;
    api
      .deletePrivilegedIdentityUser(userId)
      .then(() => {
        alert?.success('Privileged Identity deleted successfully.');
        clearForm();
      })
      .catch((e) => {
        alert?.warning(`Failed to delete Privileged Indentity. ${(e as Error).message}`);
      });
  }

  function clearForm() {
    userListRef.current?.clearValue();
    officeListRef.current?.clearValue();
    roleListRef.current?.clearValue();
    datePickerRef.current?.clearValue();
    enableForm(false);
  }

  function getMaxDate() {
    return new Date(Date.now() + 1000 * 3600 * 24 * 365).toISOString().split('T')[0];
  }

  useEffect(() => {
    setIsLoaded(false);
    api.getRoleAndOfficeGroupNames().then((groups) => {
      // Sort the office names.
      const officeMap = new Map<string, string>();
      groups.data.offices.forEach((officeName) => {
        const parts = officeName.split(' ');
        parts[3] = parts[3].padStart(2, '0');
        const sortableOfficeName = parts.join(' ');

        officeMap.set(sortableOfficeName, officeName);
      });
      const offices = Array.from(officeMap.keys())
        .sort()
        .map((key) => officeMap.get(key)!);

      // Sort and filter the role names.
      const rolesToExclude = ['USTP CAMS Super User', 'USTP CAMS Privileged Identity Management'];
      const roles = groups.data.roles
        .filter((roleName) => !rolesToExclude.includes(roleName))
        .sort();

      setGroupNames({
        roles,
        offices,
      });

      // Get the eligible users.
      api.getPrivilegedIdentityUsers().then((res) => {
        setUserList(
          res.data.sort((a: CamsUserReference, b: CamsUserReference) => {
            if (a.name > b.name) return 1;
            if (a.name < b.name) return -1;
            return 0;
          }),
        );
        setIsLoaded(true);
      });
    });
  }, []);

  return (
    <div className="privileged-identity-admin-panel">
      <h2>Privileged Identity</h2>
      {!isLoaded && <LoadingSpinner caption="Loading..."></LoadingSpinner>}
      {isLoaded && (
        <div className="privileged-identity-form">
          <div className="grid-row">
            <div className="user-list-container grid-col-5">
              <ComboBox
                id="user-list"
                label="User"
                options={userList.map((user) => {
                  return {
                    value: user.id,
                    label: user.name,
                  };
                })}
                onUpdateSelection={handleSelectUser}
                multiSelect={false}
                value={selectedUser?.id}
                ref={userListRef}
              ></ComboBox>
            </div>
          </div>
          <div className="grid-row">
            <div className="office-list-container grid-col-5">
              <ComboBox
                id="office-list"
                label="Offices"
                options={groupNames.offices.map((office) => {
                  return {
                    value: office,
                    label: office.replace('USTP CAMS ', ''),
                    //selected: !!pimRecord && pimRecord.claims.groups.includes(office),
                  };
                })}
                disabled={true}
                multiSelect={true}
                ref={officeListRef}
              ></ComboBox>
            </div>
          </div>
          <div className="grid-row">
            <div className="role-list-container grid-col-5">
              <ComboBox
                id="role-list"
                label="Roles"
                options={groupNames.roles.map((role) => {
                  return {
                    value: role,
                    label: role.replace('USTP CAMS ', ''),
                    //selected: !!pimRecord && pimRecord.claims.groups.includes(role),
                  };
                })}
                disabled={true}
                ref={roleListRef}
                multiSelect={true}
              ></ComboBox>
            </div>
          </div>
          <div className="grid-row">
            <div className="expiration-container grid-col-5">
              <DatePicker
                id="privileged-expiration-date"
                label="Expires on"
                disabled={true}
                minDate="2025-01-01"
                maxDate={getMaxDate()}
                ref={datePickerRef}
              ></DatePicker>
            </div>
          </div>
          <div className="grid-row">
            <div className="button-bar grid-col-5">
              <div className="button-bar-left-side">
                <div className="delete-button button-container">
                  <Button
                    uswdsStyle={UswdsButtonStyle.Secondary}
                    onClick={handleDelete}
                    disabled={true}
                    ref={deleteButtonRef}
                  >
                    Delete User
                  </Button>
                </div>
              </div>
              <div className="button-bar-right-side">
                <div className="save-button button-container">
                  <Button
                    uswdsStyle={UswdsButtonStyle.Default}
                    onClick={handleSave}
                    disabled={true}
                    ref={saveButtonRef}
                  >
                    Save
                  </Button>
                </div>
                <div className="cancel-button button-container">
                  <Button
                    uswdsStyle={UswdsButtonStyle.Unstyled}
                    disabled={true}
                    onClick={clearForm}
                    ref={cancelButtonRef}
                  >
                    Discard
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
