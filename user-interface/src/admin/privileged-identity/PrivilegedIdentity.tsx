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
import { symmetricDifference } from '@common/cams/utilities';
import { getIsoDate, getTodaysIsoDate } from '@common/date-helper';
import React, { useEffect, useRef, useState } from 'react';

export function PrivilegedIdentity() {
  const flags = useFeatureFlags();
  const api = useApi2();

  const [isLoaded, setIsLoaded] = useState(false);
  const [groupNames, setGroupNames] = useState<RoleAndOfficeGroupNames>({
    offices: [],
    roles: [],
  });
  const [userList, setUserList] = useState<CamsUserReference[]>([]);
  const [existingGroupNameSet, setExistingGroupNameSet] = useState<Set<string>>(new Set());
  const [existingExpiration, setExistingExpiration] = useState<null | string>(null);
  const [updatedGroupNameSet, setUpdatedGroupNameSet] = useState<Set<string>>(new Set());
  const [newExpiration, setNewExpiration] = useState<null | string>(null);

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
      <div className="privileged-identity-admin-panel">
        <Alert
          id="privileged-identity-disabled-alert"
          inline={true}
          show={true}
          title="Disabled"
          type={UswdsAlertStyle.Info}
        >
          Privileged Identity Management is disabled in this environment.
        </Alert>
      </div>
    );
  }

  function disableForm(doDisable: boolean = true) {
    officeListRef.current?.disable(doDisable);
    roleListRef.current?.disable(doDisable);
    datePickerRef.current?.disable(doDisable);
    deleteButtonRef.current?.disableButton(doDisable);
    cancelButtonRef.current?.disableButton(doDisable);
  }

  function enableForm() {
    disableForm(false);
  }

  function isSavable() {
    return isFormDirty() && updatedGroupNameSet.size > 0 && !!newExpiration;
  }

  function isDeletable() {
    return !!existingExpiration && existingGroupNameSet.size > 0;
  }

  function isFormDirty() {
    return (
      symmetricDifference(existingGroupNameSet, updatedGroupNameSet).size > 0 ||
      existingExpiration !== newExpiration
    );
  }

  function handleGroupNameUpdate() {
    const formGroupNameSet = new Set<string>([
      ...(officeListRef.current?.getSelections() ?? []).map((option) => option.value),
      ...(roleListRef.current?.getSelections() ?? []).map((option) => option.value),
    ]);
    setUpdatedGroupNameSet(formGroupNameSet);
  }

  function handleExpirationUpdate(ev: React.ChangeEvent<HTMLInputElement>) {
    setNewExpiration(ev.target.value);
  }

  function handleSelectUser(options: ComboOption[]) {
    if (options.length === 1) {
      const userId = options[0].value;
      api
        .getPrivilegedIdentityUser(userId)
        .then((response) => {
          const groups = response.data.claims.groups;
          const expires = response.data.expires;

          setExistingGroupNameSet(new Set<string>(groups));
          setExistingExpiration(expires);
          setNewExpiration(expires);

          officeListRef.current?.setSelections(
            groupNames.offices
              .filter((groupName) => groups.includes(groupName))
              .map((groupName) => toComboOption(groupName)),
          );
          roleListRef.current?.setSelections(
            groupNames.roles
              .filter((groupName) => groups.includes(groupName))
              .map((groupName) => toComboOption(groupName)),
          );
          datePickerRef.current?.setValue(expires);
          enableForm();
        })
        .catch(() => {
          setExistingGroupNameSet(new Set<string>(new Set<string>()));
          setExistingExpiration(null);

          officeListRef.current?.clearSelections();
          roleListRef.current?.clearSelections();
          datePickerRef.current?.clearValue();
          enableForm();
          deleteButtonRef.current?.disableButton(true);
        });
    } else {
      clearForm();
    }
  }

  async function handleSave() {
    const userId = userListRef.current?.getSelections()[0].value;
    const permissions: ElevatePrivilegedUserAction = {
      expires: datePickerRef.current?.getValue() ?? getTodaysIsoDate(),
      groups: [
        ...(roleListRef.current?.getSelections().map((option) => option.value) || []),
        ...(officeListRef.current?.getSelections().map((option) => option.value) || []),
      ],
    };
    try {
      await api.putPrivilegedIdentityUser(userId, permissions).then(() => {
        setExistingExpiration(newExpiration);
        setExistingGroupNameSet(updatedGroupNameSet);
        alert?.success(
          'Privileged Identity saved successfully. User must log out and log back in to see the proper permissions' +
            ' reflected.',
        );
      });
    } catch (e) {
      alert?.warning(`Failed to save Privileged Identity. ${(e as Error).message}`);
    }
  }

  async function handleDelete() {
    const userId = userListRef.current?.getSelections()[0].value;
    api
      .deletePrivilegedIdentityUser(userId)
      .then(() => {
        alert?.success(
          'Privileged Identity deleted successfully. User must log out and log back in to see the proper permissions ' +
            'reflected.',
        );
        clearForm();
      })
      .catch((e) => {
        alert?.warning(`Failed to delete Privileged Identity. ${(e as Error).message}`);
      });
  }

  function discard() {
    clearForm();
    userListRef.current?.clearSelections();
  }

  function clearForm() {
    officeListRef.current?.clearSelections();
    roleListRef.current?.clearSelections();
    datePickerRef.current?.clearValue();
    disableForm();
  }

  function getMaxDate() {
    const oneYearFromNow = new Date();
    oneYearFromNow.setUTCFullYear(oneYearFromNow.getUTCFullYear() + 1);
    return getIsoDate(oneYearFromNow);
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
        offices,
        roles,
      });

      // Get the eligible users.
      api.getPrivilegedIdentityUsers().then((res) => {
        setUserList(res.data.sort(sortUserList));
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
                multiSelect={false}
                onUpdateSelection={handleSelectUser}
                options={userList.map((user) => {
                  return {
                    label: user.name,
                    value: user.id,
                  };
                })}
                ref={userListRef}
              ></ComboBox>
            </div>
          </div>
          <div className="grid-row">
            <div className="office-list-container grid-col-5">
              <ComboBox
                disabled={true}
                id="office-list"
                label="Offices"
                multiSelect={true}
                onUpdateSelection={handleGroupNameUpdate}
                options={groupNames.offices.map((office) => {
                  return toComboOption(office);
                })}
                pluralLabel="offices"
                ref={officeListRef}
                singularLabel="office"
              ></ComboBox>
            </div>
          </div>
          <div className="grid-row">
            <div className="role-list-container grid-col-5">
              <ComboBox
                disabled={true}
                id="role-list"
                label="Roles"
                multiSelect={true}
                onUpdateSelection={handleGroupNameUpdate}
                options={groupNames.roles.map((role) => {
                  return toComboOption(role);
                })}
                pluralLabel="roles"
                ref={roleListRef}
                singularLabel="role"
              ></ComboBox>
            </div>
          </div>
          <div className="grid-row">
            <div className="expiration-container grid-col-5">
              <DatePicker
                disabled={true}
                id="privileged-expiration-date"
                label="Expires on"
                maxDate={getMaxDate()}
                minDate={getTodaysIsoDate()}
                onChange={handleExpirationUpdate}
                ref={datePickerRef}
              ></DatePicker>
            </div>
          </div>
          <div className="grid-row">
            <div className="button-bar grid-col-5">
              <div className="button-bar-left-side">
                <div className="delete-button button-container">
                  <Button
                    disabled={!isDeletable()}
                    id="delete-button"
                    onClick={handleDelete}
                    ref={deleteButtonRef}
                    uswdsStyle={UswdsButtonStyle.Secondary}
                  >
                    Delete Privilege
                  </Button>
                </div>
              </div>
              <div className="button-bar-right-side">
                <div className="save-button button-container">
                  <Button
                    disabled={!isSavable()}
                    id="save-button"
                    onClick={handleSave}
                    ref={saveButtonRef}
                    uswdsStyle={UswdsButtonStyle.Default}
                  >
                    Save
                  </Button>
                </div>
                <div className="cancel-button button-container">
                  <Button
                    disabled={true}
                    id="cancel-button"
                    onClick={discard}
                    ref={cancelButtonRef}
                    uswdsStyle={UswdsButtonStyle.Unstyled}
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

export function sortUserList(a: CamsUserReference, b: CamsUserReference) {
  if (a.name > b.name) return 1;
  if (a.name < b.name) return -1;
  return 0;
}

export function toComboOption(groupName: string) {
  return {
    label: groupName.replace('USTP CAMS ', ''),
    value: groupName,
  };
}
